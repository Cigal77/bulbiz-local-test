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
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: connection.refresh_token, grant_type: "refresh_token" }),
    });
    const data = await resp.json();
    if (!resp.ok) return null;
    await supabase.from("gmail_connections").update({ access_token: data.access_token, token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString() }).eq("user_id", userId);
    return data.access_token;
  } catch { return null; }
}

async function sendViaGmail(accessToken: string, from: string, to: string, subject: string, html: string): Promise<boolean> {
  const message = [`From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=UTF-8`, ``, html].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(message))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
  if (!resp.ok) { const err = await resp.text(); console.error("Gmail API error:", err); return false; }
  await resp.json();
  return true;
}

async function getGmailConnection(supabase: any, userId: string) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) return null;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const newToken = await refreshGmailToken(supabase, userId, conn);
    if (newToken) { conn.access_token = newToken; } else { return null; }
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

    const token = authHeader.replace("Bearer ", "");
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) throw new Error("Invalid token");
    const payload = JSON.parse(atob(payloadBase64));
    const userId = payload.sub;
    if (!userId) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("Missing invoice_id");

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .eq("user_id", userId)
      .single();
    if (invErr || !invoice) throw new Error("Facture introuvable");

    // Auto-generate PDF if not yet done
    let pdfUrl = invoice.pdf_url;
    if (!pdfUrl) {
      try {
        const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-invoice-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ invoice_id }),
        });
        const pdfData = await pdfRes.json();
        if (pdfData?.pdf_url) pdfUrl = pdfData.pdf_url;
      } catch (e) {
        console.error("PDF generation before send failed:", e);
      }
    }

    // Generate client token if not already present
    let clientToken = invoice.client_token;
    if (!clientToken) {
      clientToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const tokenExpires = new Date();
      tokenExpires.setDate(tokenExpires.getDate() + 90);
      await supabase
        .from("invoices")
        .update({
          client_token: clientToken,
          client_token_expires_at: tokenExpires.toISOString(),
        })
        .eq("id", invoice_id);
    }

    // Update status to sent
    await supabase.from("invoices").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invoice_id);

    // ── Fetch profile for artisanName + signature ──
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    const artisanName = profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || invoice.artisan_company || invoice.artisan_name || "Votre artisan";
    const emailSignature = profile?.email_signature || `Cordialement,<br/>${artisanName}`;
    const emailSubject = `${artisanName} - Facture ${invoice.invoice_number}`;

    let emailSent = false;
    let emailError: string | null = null;

    // Build email HTML
    const buildEmailHtml = () => `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>Bonjour ${invoice.client_first_name || ""},</p>
      <p>Suite à notre intervention, veuillez trouver ci-joint votre facture <strong>${invoice.invoice_number}</strong>.</p>
      ${pdfUrl ? `<p style="margin: 16px 0;"><a href="${pdfUrl}" style="color: #2563eb; text-decoration: underline;">Télécharger le PDF de votre facture</a></p>` : ""}
      <p>N'hésitez pas à nous contacter pour toute question.</p>
      ${invoice.artisan_email ? `<p style="font-size: 13px; color: #374151;">Email : ${invoice.artisan_email}</p>` : ""}
      ${invoice.artisan_phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${invoice.artisan_phone}</p>` : ""}
      <br/>
      <p>${emailSignature}</p>
    </div>`;

    // Send email
    if (invoice.client_email) {
      const gmailConn = await getGmailConnection(supabase, userId);

      if (gmailConn) {
        emailSent = await sendViaGmail(gmailConn.access_token, `${artisanName} <${gmailConn.gmail_address}>`, invoice.client_email, emailSubject, buildEmailHtml());
      }

      if (!emailSent) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          try {
            const resend = new Resend(resendKey);
            await resend.emails.send({
              from: `${artisanName} <noreply@bulbiz.fr>`,
              to: [invoice.client_email],
              subject: emailSubject,
              html: buildEmailHtml(),
            });
            emailSent = true;
          } catch (err: any) {
            emailError = err.message;
            console.error("Email send error:", err);
          }
        }
      }
    }

    // Historique
    await supabase.from("historique").insert({
      dossier_id: invoice.dossier_id,
      user_id: userId,
      action: "invoice_sent",
      details: emailSent
        ? `Facture ${invoice.invoice_number} envoyée par email à ${invoice.client_email}`
        : `Facture ${invoice.invoice_number} marquée comme envoyée`,
    });

    try {
      await supabase.from("email_log").insert({
        user_id: userId,
        dossier_id: invoice.dossier_id,
        document_type: "invoice",
        document_id: invoice.id,
        template: "invoice_sent",
        recipient: invoice.client_email,
        provider: emailSent ? "auto" : "none",
        status: emailSent ? "sent" : "failed",
        error: emailError,
      });
    } catch (_) {/* silent */}

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        email_error: emailError,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Error in send-invoice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
