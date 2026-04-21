import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshToken(refreshToken: string, clientId: string, clientSecret: string) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error_description || "Token refresh failed");
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!googleClientId || !googleClientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    const { action, code, redirect_uri, event, dossier_id, event_id } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (action === "authorize") {
      if (!redirect_uri) throw new Error("Missing redirect_uri");

      const scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" ");

      const params = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri,
        response_type: "code",
        scope: scopes,
        access_type: "offline",
        prompt: "consent",
        state: "google_calendar",
      });

      return new Response(JSON.stringify({ auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require auth
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "callback") {
      if (!code || !redirect_uri) throw new Error("Missing code or redirect_uri");

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) {
        console.error("Google Calendar token exchange failed:", JSON.stringify(tokenData));
        console.error("redirect_uri used:", redirect_uri);
        const hint = tokenData.error === "redirect_uri_mismatch"
          ? "L'URI de redirection n'est pas autorisée dans Google Cloud Console. Ajoutez : " + redirect_uri
          : tokenData.error === "invalid_grant"
          ? "Code expiré ou URI de redirection incorrecte. Vérifiez la configuration Google Cloud."
          : tokenData.error_description || "Échec de l'échange de token";
        throw new Error(hint);
      }

      const userinfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userinfo = await userinfoResp.json();
      if (!userinfo.email) throw new Error("Impossible de récupérer l'email du compte Google.");

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Store in google_calendar_connections table
      const { error: upsertErr } = await supabase
        .from("google_calendar_connections")
        .upsert({
          user_id: user.id,
          google_email: userinfo.email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || "",
          token_expires_at: expiresAt,
        }, { onConflict: "user_id" });
      if (upsertErr) throw new Error("Failed to save Google Calendar connection");

      return new Response(JSON.stringify({ success: true, google_email: userinfo.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await supabase.from("google_calendar_connections").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: connection } = await supabase
        .from("google_calendar_connections")
        .select("google_email, token_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(JSON.stringify({
        connected: !!connection,
        google_email: connection?.google_email || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add_event") {
      if (!event) throw new Error("Missing event data");

      // Get connection
      const { data: connection, error: connErr } = await supabase
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (connErr || !connection) throw new Error("Google Calendar non connecté");

      // Refresh token if expired
      let accessToken = connection.access_token;
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        const newTokens = await refreshToken(connection.refresh_token, googleClientId, googleClientSecret);
        accessToken = newTokens.access_token;
        const newExpiry = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();
        await supabase.from("google_calendar_connections").update({
          access_token: accessToken,
          token_expires_at: newExpiry,
        }).eq("user_id", user.id);
      }

      // Create Google Calendar event
      const calendarEvent = {
        summary: event.summary,
        description: event.description || "",
        location: event.location || "",
        start: {
          dateTime: `${event.date}T${event.start_time}:00`,
          timeZone: "Europe/Paris",
        },
        end: {
          dateTime: `${event.date}T${event.end_time}:00`,
          timeZone: "Europe/Paris",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "popup", minutes: 60 },
          ],
        },
      };

      const calResp = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      });

      const calData = await calResp.json();
      if (!calResp.ok) {
        console.error("Google Calendar API error:", calData);
        throw new Error(calData.error?.message || "Erreur lors de l'ajout à Google Calendar");
      }

      // Log in historique if dossier_id provided
      if (dossier_id) {
        await supabase.from("historique").insert({
          dossier_id,
          user_id: user.id,
          action: "google_calendar_synced",
          details: `RDV ajouté à Google Calendar (${connection.google_email})`,
        });
      }

      return new Response(JSON.stringify({ success: true, event_id: calData.id, html_link: calData.htmlLink }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_event") {
      if (!event_id) throw new Error("Missing event_id");

      const { data: connection, error: connErr } = await supabase
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (connErr || !connection) throw new Error("Google Calendar non connecté");

      let accessToken = connection.access_token;
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        const newTokens = await refreshToken(connection.refresh_token, googleClientId, googleClientSecret);
        accessToken = newTokens.access_token;
        const newExpiry = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();
        await supabase.from("google_calendar_connections").update({
          access_token: accessToken,
          token_expires_at: newExpiry,
        }).eq("user_id", user.id);
      }

      const delResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!delResp.ok && delResp.status !== 404) {
        const errData = await delResp.json();
        console.error("Google Calendar delete error:", errData);
        throw new Error(errData.error?.message || "Erreur suppression Google Calendar");
      }

      if (dossier_id) {
        await supabase.from("historique").insert({
          dossier_id,
          user_id: user.id,
          action: "google_calendar_deleted",
          details: `RDV supprimé de Google Calendar (${connection.google_email})`,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_event") {
      if (!event_id) throw new Error("Missing event_id");
      if (!event) throw new Error("Missing event data");

      const { data: connection, error: connErr } = await supabase
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (connErr || !connection) throw new Error("Google Calendar non connecté");

      let accessToken = connection.access_token;
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        const newTokens = await refreshToken(connection.refresh_token, googleClientId, googleClientSecret);
        accessToken = newTokens.access_token;
        const newExpiry = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();
        await supabase.from("google_calendar_connections").update({
          access_token: accessToken,
          token_expires_at: newExpiry,
        }).eq("user_id", user.id);
      }

      const calendarEvent = {
        summary: event.summary,
        description: event.description || "",
        location: event.location || "",
        start: {
          dateTime: `${event.date}T${event.start_time}:00`,
          timeZone: "Europe/Paris",
        },
        end: {
          dateTime: `${event.date}T${event.end_time}:00`,
          timeZone: "Europe/Paris",
        },
      };

      const calResp = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(calendarEvent),
        },
      );

      // 404 / 410 → event was deleted in Google. Tell the caller so it can fallback to add_event.
      if (calResp.status === 404 || calResp.status === 410) {
        return new Response(
          JSON.stringify({ success: false, not_found: true, message: "Event not found in Google Calendar" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const calData = await calResp.json();
      if (!calResp.ok) {
        console.error("Google Calendar update error:", calData);
        throw new Error(calData.error?.message || "Erreur mise à jour Google Calendar");
      }

      if (dossier_id) {
        await supabase.from("historique").insert({
          dossier_id,
          user_id: user.id,
          action: "google_calendar_updated",
          details: `RDV mis à jour dans Google Calendar (${connection.google_email})`,
        });
      }

      return new Response(JSON.stringify({ success: true, event_id: calData.id, html_link: calData.htmlLink }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    console.error("Error in google-calendar:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
