import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { action, code, redirect_uri } = await req.json();

    // For authorize and status/disconnect, we need the user
    const authHeader = req.headers.get("Authorization");

    if (action === "authorize") {
      if (!redirect_uri) throw new Error("Missing redirect_uri");

      const scopes = [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" ");

      const params = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri,
        response_type: "code",
        scope: scopes,
        access_type: "offline",
        prompt: "consent",
        state: "gmail",
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require authentication
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "callback") {
      if (!code || !redirect_uri) throw new Error("Missing code or redirect_uri");

      // Exchange code for tokens
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
        console.error("Token exchange failed:", tokenData);
        throw new Error(tokenData.error_description || "Token exchange failed");
      }

      // Get user email from Google
      const userinfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userinfo = await userinfoResp.json();

      // Basic validation
      if (!userinfo.email) {
        throw new Error("Impossible de récupérer l'email du compte Google.");
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Upsert gmail connection
      const { error: upsertErr } = await supabase.from("gmail_connections").upsert(
        {
          user_id: user.id,
          gmail_address: userinfo.email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || "",
          token_expires_at: expiresAt,
        },
        { onConflict: "user_id" },
      );

      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
        throw new Error("Failed to save Gmail connection");
      }

      return new Response(JSON.stringify({ success: true, gmail_address: userinfo.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await supabase.from("gmail_connections").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: connection } = await supabase
        .from("gmail_connections")
        .select("gmail_address, token_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          connected: !!connection,
          gmail_address: connection?.gmail_address || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("Error in gmail-oauth:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
