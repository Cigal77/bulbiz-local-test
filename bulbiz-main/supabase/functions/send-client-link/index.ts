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
    await supabase
      .from("gmail_connections")
      .update({
        access_token: data.access_token,
        token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const jwtToken = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(jwtToken.split(".")[1]));
    const userId = payload.sub;
    if (!userId) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dossier_id, force_regenerate } = await req.json();
    if (!dossier_id) throw new Error("Missing dossier_id");

    const { data: dossier, error: dErr } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", dossier_id)
      .eq("user_id", userId)
      .single();
    if (dErr || !dossier) throw new Error("Dossier introuvable");

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).single();

    const validityDays = profile?.client_link_validity_days || 7;

    let token = dossier.client_token;
    let expiresAt = dossier.client_token_expires_at;
    let tokenGenerated = false;

    const isExpired = !expiresAt || new Date(expiresAt) < new Date();

    if (!token || isExpired || force_regenerate) {
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      token = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("dossiers")
        .update({ client_token: token, client_token_expires_at: expiresAt })
        .eq("id", dossier_id);

      tokenGenerated = true;

      await supabase.from("historique").insert({
        dossier_id,
        user_id: userId,
        action: "client_link_generated",
        details: `Lien client généré (expire le ${new Date(expiresAt).toLocaleDateString("fr-FR")})`,
      });
    }

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/+$/, "") ||
      Deno.env.get("PUBLIC_URL") ||
      "https://bulbiz.io";
    const clientLink = `${origin}/client?token=${token}`;

    let emailSent = false;
    let emailError: string | null = null;

    if (dossier.client_email) {
      const gmailConn = await getGmailConnection(supabase, userId);
      const artisanName =
        profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
      const signature = profile?.email_signature || `Cordialement,\n${artisanName}`;
      const emailSubject = `${artisanName} – Complétez votre demande d'intervention`;
      const emailHtml = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <p>Bonjour ${dossier.client_first_name || ""},</p>
              <p>Merci pour votre demande. Pour préparer au mieux notre intervention, nous avons besoin de quelques informations complémentaires.</p>
              <p style="margin: 24px 0;">
                <a href="${clientLink}" style="display:inline-block;background:#2563eb;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
                  📝 Compléter ma demande
                </a>
              </p>
              <p style="font-size: 13px; color: #6b7280;">Ce lien est valable ${validityDays} jours.</p>
              <p>N'hésitez pas à nous contacter pour toute question.</p>
              ${profile?.email ? `<p style="font-size: 13px; color: #374151;">Email : ${profile.email}</p>` : ""}
              ${profile?.phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${profile.phone}</p>` : ""}
              <br/>
              <p style="white-space: pre-line;">${signature}</p>
            </div>`;

      if (gmailConn) {
        emailSent = await sendViaGmail(
          gmailConn.access_token,
          `${artisanName} <${gmailConn.gmail_address}>`,
          dossier.client_email,
          emailSubject,
          emailHtml,
        );
      }

      if (!emailSent) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          try {
            const resend = new Resend(resendKey);
            await resend.emails.send({
              from: "noreply@bulbiz.fr",
              to: [dossier.client_email],
              subject: emailSubject,
              html: emailHtml,
            });
            emailSent = true;
          } catch (err: any) {
            emailError = err.message;
            console.error("Email send error:", err);
          }
        }
      }

      if (emailSent) {
        await supabase.from("historique").insert({
          dossier_id,
          user_id: userId,
          action: "client_link_sent_email",
          details: `Lien client envoyé par email à ${dossier.client_email}`,
        });
      }
    }

    // Log if no contact info
    if (!dossier.client_email) {
      await supabase.from("historique").insert({
        dossier_id,
        user_id: userId,
        action: "client_link_not_sent",
        details: "Email manquant : lien non envoyé",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        expires_at: expiresAt,
        client_link: clientLink,
        token_generated: tokenGenerated,
        email_sent: emailSent,
        email_error: emailError,
        no_contact: !dossier.client_email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error in send-client-link:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
