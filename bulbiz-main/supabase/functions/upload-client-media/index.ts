import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const token = formData.get("token") as string | null;
    const slug = formData.get("slug") as string | null;
    const file = formData.get("file") as File;

    if ((!token && !slug) || !file) {
      return new Response(
        JSON.stringify({ error: `Token/slug et fichier requis (token: ${!!token}, slug: ${!!slug}, file: ${!!file})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (max 200MB to match client limit)
    if (file.size > 200 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Fichier trop volumineux (max 200 MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type (strip codec params like "video/webm;codecs=vp9,opus")
    const baseType = file.type.split(";")[0].trim().toLowerCase();
    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
      "video/mp4", "video/quicktime", "video/webm", "video/3gpp",
      "audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/aac",
      "application/pdf",
    ];
    if (!allowedTypes.includes(baseType)) {
      return new Response(
        JSON.stringify({ error: `Type de fichier non autorisé : ${file.type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string;
    let filePath: string;
    const ext = file.name.split(".").pop() || "bin";

    if (token) {
      // ── Existing flow: validate client_token from dossiers ──
      const { data: dossier, error: dossierError } = await supabase
        .from("dossiers")
        .select("id, user_id, client_token_expires_at")
        .eq("client_token", token)
        .single();

      if (dossierError || !dossier) {
        return new Response(
          JSON.stringify({ error: "Lien invalide ou expiré" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (dossier.client_token_expires_at && new Date(dossier.client_token_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Ce lien a expiré" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = dossier.user_id;
      filePath = `${userId}/${dossier.id}/client_${Date.now()}.${ext}`;
    } else {
      // ── New flow: validate slug from profiles ──
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("public_client_slug", slug!)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: "Artisan introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = profile.user_id;
      filePath = `${userId}/public-uploads/client_${Date.now()}.${ext}`;
    }

    // Upload file using service role (bypasses storage RLS)
    const { error: uploadError } = await supabase.storage
      .from("dossier-medias")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    // Return storage path (bucket is private, signed URLs generated on read)
    return new Response(
      JSON.stringify({
        url: filePath,
        name: file.name,
        type: file.type,
        size: file.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("upload-client-media error:", e);
    try {
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc.from("error_logs").insert({
        source: "edge_function",
        function_name: "upload-client-media",
        error_message: e instanceof Error ? e.message : String(e),
        error_stack: e instanceof Error ? e.stack : null,
      });
    } catch { /* silent */ }
    return new Response(
      JSON.stringify({ error: "Erreur lors de l'upload" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
