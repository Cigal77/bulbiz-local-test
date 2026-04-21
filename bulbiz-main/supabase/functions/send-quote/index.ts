import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Gmail helpers ──
async function refreshGmailToken(supabase: any, userId: string, connection: any): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !connection.refresh_token) return null;
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return null;
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
    await supabase
      .from("gmail_connections")
      .update({
        access_token: data.access_token,
        token_expires_at: expiresAt,
      })
      .eq("user_id", userId);
    return data.access_token;
  } catch {
    return null;
  }
}

async function sendViaGmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("Gmail API error:", err);
    return false;
  }
  await resp.json();
  return true;
}

async function getGmailConnection(supabase: any, userId: string) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) return null;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const newToken = await refreshGmailToken(supabase, userId, conn);
    if (newToken) {
      conn.access_token = newToken;
    } else {
      return null;
    }
  }
  return conn;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: authHeader,
      },
    });

    if (!userResp.ok) {
      const t = await userResp.text();
      console.error("auth/v1/user failed:", userResp.status, t);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await userResp.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quote_id } = await req.json();
    if (!quote_id) throw new Error("Missing quote_id");

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quote_id)
      .eq("user_id", user.id)
      .single();
    if (qErr || !quote) throw new Error("Devis introuvable");

    const { data: dossier, error: dErr } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", quote.dossier_id)
      .eq("user_id", user.id)
      .single();
    if (dErr || !dossier) throw new Error("Dossier introuvable");

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

    const artisanName =
      profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
    const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;

    // Réutilise le signature_token existant s'il est encore valide >24h.
    // Régénérer à chaque envoi cassait les liens cliqués par le client précédemment.
    let signatureToken = (quote as any).signature_token as string | null;
    let expiresAt = (quote as any).signature_token_expires_at as string | null;
    const tokenStillValid =
      signatureToken && expiresAt && new Date(expiresAt).getTime() > Date.now() + 24 * 60 * 60 * 1000;
    if (!tokenStillValid) {
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      signatureToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const origin =
      req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "https://app.bulbiz.io";
    const validationUrl = `${origin}/devis/validation?token=${signatureToken}`;

    // Génère le PDF avant l'envoi pour fournir un vrai lien de téléchargement
    let pdfUrl: string | null = (quote as any).pdf_url ?? null;
    try {
      const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-quote-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: supabaseServiceKey,
        },
        body: JSON.stringify({ quote_id }),
      });
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        if (pdfData?.pdf_url) pdfUrl = pdfData.pdf_url;
      } else {
        console.error("generate-quote-pdf failed:", pdfRes.status, await pdfRes.text());
      }
    } catch (e) {
      console.error("generate-quote-pdf threw:", e);
    }

    const pdfLinkBlock = pdfUrl
      ? `<p style="margin: 12px 0;"><a href="${pdfUrl}" style="color: #2563eb; text-decoration: underline;">📄 Télécharger le PDF du devis</a></p>`
      : "";

    // Send email - try Gmail first, fallback to Resend
    if (dossier.client_email) {
      const gmailConn = await getGmailConnection(supabase, user.id);
      let emailSent = false;

      if (gmailConn) {
        const fromAddr = gmailConn.gmail_address;
        emailSent = await sendViaGmail(
          gmailConn.access_token,
          `${artisanName} <${fromAddr}>`,
          dossier.client_email,
          `${artisanName} – Votre devis`,
          `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p>Bonjour ${dossier.client_first_name || ""},</p>
            <p>Veuillez trouver votre devis ci-dessous.</p>
            ${pdfLinkBlock}
            <p style="margin: 24px 0;">
              <a href="${validationUrl}" style="background-color: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                ✅ Voir et valider le devis
              </a>
            </p>
            <p style="font-size: 13px; color: #6b7280;">Ce lien est valable 30 jours.</p>
            <p>N'hésitez pas à nous contacter pour toute question.</p>
            ${profile?.email ? `<p style="font-size: 13px; color: #374151;">Email : ${profile.email}</p>` : ""}
            ${profile?.phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${profile.phone}</p>` : ""}
            <br/>
            <p style="white-space: pre-line;">${signature}</p>
          </div>`,
        );
      }

      if (!emailSent) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: `${artisanName} <noreply@bulbiz.fr>`,
          to: [dossier.client_email],
          subject: `${artisanName} – Votre devis`,
          html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <p>Bonjour ${dossier.client_first_name || ""},</p>
              <p>Veuillez trouver votre devis ci-dessous.</p>
              ${pdfLinkBlock}
              <p style="margin: 24px 0;">
                <a href="${validationUrl}" style="background-color: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  ✅ Voir et valider le devis
                </a>
              </p>
              <p style="font-size: 13px; color: #6b7280;">Ce lien est valable 30 jours.</p>
              <p>N'hésitez pas à nous contacter pour toute question.</p>
              ${profile?.email ? `<p style="font-size: 13px; color: #374151;">Email : ${profile.email}</p>` : ""}
              ${profile?.phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${profile.phone}</p>` : ""}
              <br/>
              <p style="white-space: pre-line;">${signature}</p>
            </div>`,
        });
      }

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user.id,
        action: "quote_sent",
        details: `Devis ${quote.quote_number} envoyé par email à ${dossier.client_email}`,
      });

      try {
        await supabase.from("email_log").insert({
          user_id: user.id,
          dossier_id: dossier.id,
          document_type: "quote",
          document_id: quote.id,
          template: "quote_sent",
          recipient: dossier.client_email,
          provider: gmailConn ? "gmail" : "resend",
          status: "sent",
        });
      } catch (_) {/* table peut être absente sur anciennes envs */}
    }

    // Update quote status
    await supabase
      .from("quotes")
      .update({
        status: "envoye",
        sent_at: new Date().toISOString(),
        signature_token: signatureToken,
        signature_token_expires_at: expiresAt,
      })
      .eq("id", quote_id);

    await supabase
      .from("dossiers")
      .update({
        status: "devis_envoye",
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", dossier.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-quote:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
