import { Resend } from "npm:resend@2.0.0";

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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const { first_name, last_name, email, phone } = await req.json();

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "Bulbiz <noreply@bulbiz.fr>",
      to: ["alexandre.p@bulbiz.fr"],
      subject: `Nouveau compte créé – ${first_name || ""} ${last_name || ""}`.trim(),
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Nouveau compte</h2>
          <p>Un nouveau compte artisan vient d'être créé :</p>
          <ul style="line-height: 1.8;">
            <li><strong>Prénom :</strong> ${first_name || "—"}</li>
            <li><strong>Nom :</strong> ${last_name || "—"}</li>
            <li><strong>Email :</strong> ${email || "—"}</li>
            <li><strong>Téléphone :</strong> ${phone || "—"}</li>
          </ul>
          <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
            Notification automatique.
          </p>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in notify-new-signup:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
