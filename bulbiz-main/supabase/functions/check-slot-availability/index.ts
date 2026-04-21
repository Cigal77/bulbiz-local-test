import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function slotsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug, slots } = await req.json();

    if (!slug || !Array.isArray(slots) || slots.length === 0) {
      return new Response(
        JSON.stringify({ error: "slug et slots requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find artisan by slug
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("public_client_slug", slug)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Artisan introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all confirmed appointments for this artisan
    const dates = [...new Set(slots.map((s: any) => s.date))];
    const { data: confirmedRdvs } = await supabase
      .from("dossiers")
      .select("appointment_date, appointment_time_start, appointment_time_end")
      .eq("user_id", profile.user_id)
      .in("appointment_status", ["rdv_confirmed"])
      .in("appointment_date", dates)
      .is("deleted_at", null);

    // Also check existing proposed slots (slots_proposed or rdv_pending)
    const { data: existingSlots } = await supabase
      .from("appointment_slots")
      .select("slot_date, time_start, time_end, dossier_id")
      .in("slot_date", dates);

    // Filter existing slots to only those belonging to this artisan's dossiers
    let artisanSlotDossierIds: string[] = [];
    if (existingSlots && existingSlots.length > 0) {
      const dossierIds = [...new Set(existingSlots.map(s => s.dossier_id))];
      const { data: artisanDossiers } = await supabase
        .from("dossiers")
        .select("id")
        .eq("user_id", profile.user_id)
        .in("id", dossierIds)
        .is("deleted_at", null);
      artisanSlotDossierIds = (artisanDossiers || []).map(d => d.id);
    }

    // Check each proposed slot for conflicts
    const results = slots.map((slot: { date: string; time_start: string; time_end: string }) => {
      // Check against confirmed RDVs
      const rdvConflict = (confirmedRdvs || []).some(
        (rdv: any) =>
          rdv.appointment_date === slot.date &&
          slotsOverlap(slot.time_start, slot.time_end, rdv.appointment_time_start, rdv.appointment_time_end)
      );

      if (rdvConflict) {
        return { ...slot, available: false, reason: "Ce créneau est déjà réservé." };
      }

      return { ...slot, available: true };
    });

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-slot-availability error:", e);
    try {
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc.from("error_logs").insert({
        source: "edge_function",
        function_name: "check-slot-availability",
        error_message: e instanceof Error ? e.message : String(e),
        error_stack: e instanceof Error ? e.stack : null,
      });
    } catch { /* silent */ }
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
