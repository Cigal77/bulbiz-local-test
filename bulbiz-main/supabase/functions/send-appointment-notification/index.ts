import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Gmail helpers ──
async function refreshGmailTokenFn(supabase: any, userId: string, connection: any): Promise<string | null> {
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

async function sendViaGmailFn(
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

async function getGmailConnectionFn(supabase: any, userId: string) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) return null;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const newToken = await refreshGmailTokenFn(supabase, userId, conn);
    if (newToken) {
      conn.access_token = newToken;
    } else {
      return null;
    }
  }
  return conn;
}

type EventType = "APPOINTMENT_REQUESTED" | "SLOTS_PROPOSED" | "APPOINTMENT_CONFIRMED";
type NotifStatus = "SENT" | "FAILED" | "SKIPPED";

interface NotifResult {
  email_status: NotifStatus;
  error_message?: string;
}

// ── Email templates ──
function getEmailTemplate(eventType: EventType, payload: Record<string, unknown>): { subject: string; html: string } {
  const clientName = (payload.client_first_name as string) || "Bonjour";
  const artisanName = (payload.artisan_name as string) || "Votre artisan";
  const artisanPhone = payload.artisan_phone ? ` au ${payload.artisan_phone}` : "";
  const artisanEmail = payload.artisan_email ? ` ou par email à ${payload.artisan_email}` : "";

  switch (eventType) {
    case "APPOINTMENT_REQUESTED":
      return {
        subject: `${artisanName} souhaite convenir d'un rendez-vous`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#2563eb;">📅 Proposition de rendez-vous</h2>
          <p>Bonjour ${clientName},</p>
          <p>Suite à la validation de votre devis, <strong>${artisanName}</strong> souhaite convenir d'un rendez-vous pour l'intervention.</p>
          <p>Merci de le contacter${artisanPhone}${artisanEmail} pour fixer une date.</p>
          <p>N'hésitez pas à nous contacter pour toute question.</p>
          ${payload.artisan_email ? `<p style="font-size: 13px; color: #374151;">Email : ${payload.artisan_email}</p>` : ""}
          ${payload.artisan_phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${payload.artisan_phone}</p>` : ""}
          <br/>
          <p>Cordialement,<br/>${artisanName}</p>
        </div>`,
      };

    case "SLOTS_PROPOSED": {
      const slotsHtml = (payload.slots_text as string) || "";
      const link = payload.appointment_link as string;
      return {
        subject: `${artisanName} vous propose des créneaux`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#2563eb;">📅 Choisissez votre créneau</h2>
          <p>Bonjour ${clientName},</p>
          <p><strong>${artisanName}</strong> vous propose les créneaux suivants :</p>
          ${slotsHtml}
          ${link ? `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Choisir mon créneau</a></p>` : ""}
          <p>Si aucun créneau ne vous convient, contactez-nous${artisanPhone}.</p>
          <p>N'hésitez pas à nous contacter pour toute question.</p>
          ${payload.artisan_email ? `<p style="font-size: 13px; color: #374151;">Email : ${payload.artisan_email}</p>` : ""}
          ${payload.artisan_phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${payload.artisan_phone}</p>` : ""}
          <br/>
          <p>Cordialement,<br/>${artisanName}</p>
        </div>`,
      };
    }

   case "APPOINTMENT_CONFIRMED": {
    const dateStr = (payload.appointment_date as string) || "";
    const rawDate = (payload.raw_date as string) || "";
    const timeStr = (payload.appointment_time as string) || "";
    const timeEnd = (payload.appointment_time_end as string) || "";
    const address = (payload.address as string) || "";

    let displayDate = dateStr;
    if (rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      try {
        const d = new Date(rawDate + "T12:00:00");
        if (!isNaN(d.getTime())) {
          const days = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
          const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
          displayDate = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }
      } catch { /* keep dateStr */ }
    }

    const eventTitle = `RDV – ${artisanName}`;
    const eventDescription = `Rendez-vous avec ${artisanName}${artisanPhone ? `\nTél : ${payload.artisan_phone}` : ""}${payload.artisan_email ? `\nEmail : ${payload.artisan_email}` : ""}`;

    let calendarLinksHtml = "";
    if (rawDate && timeStr) {
      const dtStart = rawDate.replace(/-/g, "") + "T" + timeStr.slice(0, 5).replace(":", "") + "00";
      const endTime = timeEnd || timeStr.replace(/^(\d{2}):(\d{2})/, (_, h, m) => `${String(Number(h) + 1).padStart(2, "0")}:${m}`);
      const dtEnd = rawDate.replace(/-/g, "") + "T" + endTime.slice(0, 5).replace(":", "") + "00";

      const gcalParams = new URLSearchParams({
        action: "TEMPLATE",
        text: eventTitle,
        dates: `${dtStart}/${dtEnd}`,
        details: eventDescription,
        ...(address ? { location: address } : {}),
      });
      const googleCalUrl = `https://calendar.google.com/calendar/render?${gcalParams.toString()}`;

      const outlookParams = new URLSearchParams({
        rru: "addevent",
        startdt: `${rawDate}T${timeStr.slice(0, 5)}:00`,
        enddt: `${rawDate}T${endTime.slice(0, 5)}:00`,
        subject: eventTitle,
        body: eventDescription,
        ...(address ? { location: address } : {}),
      });
      const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;

      calendarLinksHtml = `
        <div style="margin:20px 0;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
          <p style="margin:0 0 12px 0;font-weight:600;color:#166534;">📅 Ajouter à mon agenda :</p>
          <a href="${googleCalUrl}" target="_blank" style="display:inline-block;background:#4285f4;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:14px;margin-right:8px;margin-bottom:8px;">Google Agenda</a>
          <a href="${outlookUrl}" target="_blank" style="display:inline-block;background:#0078d4;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:14px;margin-right:8px;margin-bottom:8px;">Outlook</a>
        </div>`;
    }

    return {
      subject: `Rendez-vous confirmé avec ${artisanName} – ${displayDate}`,
      html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#16a34a;">✅ Rendez-vous confirmé</h2>
        <p>Bonjour ${clientName},</p>
        <p>Votre rendez-vous avec <strong>${artisanName}</strong> est confirmé :</p>
        <div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="font-size:18px;font-weight:bold;margin:0 0 8px 0;">📅 ${displayDate}</p>
          ${timeStr ? `<p style="font-size:16px;margin:0 0 8px 0;">🕐 ${timeStr}${timeEnd ? ` – ${timeEnd}` : ""}</p>` : ""}
          ${address ? `<p style="font-size:14px;margin:0;color:#4b5563;">📍 ${address}</p>` : ""}
        </div>
        ${calendarLinksHtml}
        <p>En cas d'empêchement, merci de nous prévenir${artisanPhone}.</p>
        ${payload.artisan_email ? `<p style="font-size: 13px; color: #374151;">Email : ${payload.artisan_email}</p>` : ""}
        ${payload.artisan_phone ? `<p style="font-size: 13px; color: #374151;">Tél : ${payload.artisan_phone}</p>` : ""}
        <br/>
        <p>Cordialement,<br/>${artisanName}</p>
      </div>`,
    };
  }
  }
}

// ── Validation helpers ──
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Event label mapping for historique ──
const EVENT_LABELS: Record<EventType, string> = {
  APPOINTMENT_REQUESTED: "proposition de rendez-vous",
  SLOTS_PROPOSED: "lien de choix de créneau",
  APPOINTMENT_CONFIRMED: "confirmation de rendez-vous",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) throw new Error("Invalid token");
    const jwtPayload = JSON.parse(atob(payloadBase64));
    const user = { id: jwtPayload.sub };
    if (!user.id) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_type, dossier_id, payload: extraPayload } = await req.json();

    if (!event_type || !dossier_id) {
      throw new Error("event_type et dossier_id requis");
    }

    const validEvents: EventType[] = ["APPOINTMENT_REQUESTED", "SLOTS_PROPOSED", "APPOINTMENT_CONFIRMED"];
    if (!validEvents.includes(event_type)) {
      throw new Error(`event_type invalide: ${event_type}`);
    }

    // Fetch dossier
    const { data: dossier, error: dossierErr } = await supabase
      .from("dossiers")
      .select("*")
      .eq("id", dossier_id)
      .single();
    if (dossierErr || !dossier) throw new Error("Dossier introuvable");

    // Verify ownership
    if (dossier.user_id !== user.id) throw new Error("Unauthorized: not your dossier");

    // Fetch artisan profile
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();

    const artisanName =
      profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";

    // ── For SLOTS_PROPOSED: ensure appointment_link exists ──
    let appointmentLink = extraPayload?.appointment_link as string || "";

    if (event_type === "SLOTS_PROPOSED" && !appointmentLink) {
      // Check if client_token exists and is not expired
      let clientToken = dossier.client_token;
      const tokenExpiry = dossier.client_token_expires_at ? new Date(dossier.client_token_expires_at) : null;
      const validityDays = profile?.client_link_validity_days || 7;

      if (!clientToken || !tokenExpiry || tokenExpiry < new Date()) {
        // Generate a new token
        clientToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("dossiers")
          .update({ client_token: clientToken, client_token_expires_at: expiresAt })
          .eq("id", dossier_id);
        console.log("Generated new client_token for SLOTS_PROPOSED email");
      }

      appointmentLink = `https://app.bulbiz.io/client?token=${clientToken}`;
    }

    // Build payload
    const notifPayload: Record<string, unknown> = {
      client_first_name: dossier.client_first_name,
      client_last_name: dossier.client_last_name,
      artisan_name: artisanName,
      artisan_phone: profile?.phone || "",
      artisan_email: profile?.email || "",
      ...extraPayload,
      ...(appointmentLink ? { appointment_link: appointmentLink } : {}),
    };

    const label = EVENT_LABELS[event_type as EventType];
    const result: NotifResult = { email_status: "SKIPPED" };

    // ── EMAIL ──
    const clientEmail = dossier.client_email;
    if (!clientEmail || !isValidEmail(clientEmail)) {
      await supabase.from("notification_logs").insert({
        dossier_id,
        event_type,
        channel: "email",
        recipient: clientEmail || "MISSING",
        status: "SKIPPED",
        error_code: "INVALID_RECIPIENT",
        error_message: clientEmail ? "Email invalide" : "Email manquant",
      });
      await supabase.from("historique").insert({
        dossier_id,
        user_id: user.id,
        action: "notification_skipped",
        details: `Email non envoyé (${label}) : email client manquant ou invalide`,
      });
      result.email_status = "SKIPPED";
    } else {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      // Try Gmail first
      const gmailConn = await getGmailConnectionFn(supabase, user.id);
      let gmailSent = false;

      if (gmailConn) {
        const template = getEmailTemplate(event_type as EventType, notifPayload);
        gmailSent = await sendViaGmailFn(
          gmailConn.access_token,
          `${artisanName} <${gmailConn.gmail_address}>`,
          clientEmail,
          template.subject,
          template.html,
        );
      }

      if (gmailSent) {
        await supabase.from("notification_logs").insert({
          dossier_id,
          event_type,
          channel: "email",
          recipient: clientEmail,
          status: "SENT",
        });
        await supabase.from("historique").insert({
          dossier_id,
          user_id: user.id,
          action: "notification_sent",
          details: `Email envoyé via Gmail : ${label} → ${clientEmail}`,
        });
        result.email_status = "SENT";
      } else if (!resendKey) {
        await supabase.from("notification_logs").insert({
          dossier_id,
          event_type,
          channel: "email",
          recipient: clientEmail,
          status: "FAILED",
          error_code: "EMAIL_NOT_CONFIGURED",
          error_message: "Service email non configuré",
        });
        await supabase.from("historique").insert({
          dossier_id,
          user_id: user.id,
          action: "notification_failed",
          details: `Email non envoyé (${label}) : service email non configuré`,
        });
        result.email_status = "FAILED";
      } else {
        try {
          const resend = new Resend(resendKey);
          const template = getEmailTemplate(event_type as EventType, notifPayload);
          await resend.emails.send({
            from: `${artisanName} <noreply@bulbiz.fr>`,
            to: [clientEmail],
            subject: template.subject,
            html: template.html,
          });

          await supabase.from("notification_logs").insert({
            dossier_id,
            event_type,
            channel: "email",
            recipient: clientEmail,
            status: "SENT",
          });
          await supabase.from("historique").insert({
            dossier_id,
            user_id: user.id,
            action: "notification_sent",
            details: `Email envoyé : ${label} → ${clientEmail}`,
          });
          result.email_status = "SENT";
        } catch (emailErr: any) {
          console.error("Email send error:", emailErr);
          await supabase.from("notification_logs").insert({
            dossier_id,
            event_type,
            channel: "email",
            recipient: clientEmail,
            status: "FAILED",
            error_code: "SEND_ERROR",
            error_message: emailErr.message?.slice(0, 500),
          });
          await supabase.from("historique").insert({
            dossier_id,
            user_id: user.id,
            action: "notification_failed",
            details: `Email non envoyé (${label}) : erreur technique`,
          });
          result.email_status = "FAILED";
          result.error_message = emailErr.message;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in send-appointment-notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
