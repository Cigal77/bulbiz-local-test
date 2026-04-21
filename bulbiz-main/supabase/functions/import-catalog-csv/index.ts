import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRow {
  [k: string]: any;
}
interface Payload {
  filename: string;
  rows: ImportRow[];
  mapping: Record<string, string>;
  dedup_strategy: "skip" | "update" | "duplicate";
}

function normalizeNumber(v: any): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body: Payload = await req.json();
    const { filename, rows, mapping, dedup_strategy } = body;

    if (!Array.isArray(rows) || !rows.length) {
      return new Response(JSON.stringify({ error: "No rows" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (rows.length > 5000) {
      return new Response(JSON.stringify({ error: "Max 5000 rows" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reverse mapping: bulbiz_field -> csv_col
    const inverseMap: Record<string, string> = {};
    for (const [csvCol, field] of Object.entries(mapping)) {
      if (field) inverseMap[field] = csvCol;
    }
    if (!inverseMap.label) {
      return new Response(JSON.stringify({ error: "Field 'label' must be mapped" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from("catalog_import_jobs")
      .insert({
        user_id: userId,
        filename,
        total_rows: rows.length,
        mapping,
        dedup_strategy,
        status: "processing",
      })
      .select("id")
      .single();
    if (jobErr || !job) throw jobErr ?? new Error("Job creation failed");

    let created = 0, updated = 0, skipped = 0, errors = 0;
    const errorDetails: { row: number; message: string }[] = [];

    // Process in batches of 100
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const toProcess: { idx: number; record: any; lookupKey: string | null }[] = [];

      for (let j = 0; j < slice.length; j++) {
        const rowIdx = i + j + 2; // +2 for header + 1-index
        const row = slice[j];
        const label = String(row[inverseMap.label] ?? "").trim();
        if (!label) {
          skipped++;
          continue;
        }
        const internal_code = inverseMap.internal_code ? String(row[inverseMap.internal_code] ?? "").trim() || null : null;
        const slug = slugify(label);

        const record: any = {
          user_id: userId,
          label,
          slug,
          normalized_name: normalizeName(label),
          import_batch_id: job.id,
          category_path: inverseMap.category_path ? String(row[inverseMap.category_path] ?? "Divers") || "Divers" : "Divers",
          subcategory: inverseMap.subcategory ? String(row[inverseMap.subcategory] ?? "") || null : null,
          unit: inverseMap.unit ? String(row[inverseMap.unit] ?? "u") || "u" : "u",
          unit_price: normalizeNumber(inverseMap.unit_price ? row[inverseMap.unit_price] : 0) ?? 0,
          vat_rate: normalizeNumber(inverseMap.vat_rate ? row[inverseMap.vat_rate] : 10) ?? 10,
          type: inverseMap.type ? String(row[inverseMap.type] ?? "PETITE_FOURNITURE") || "PETITE_FOURNITURE" : "PETITE_FOURNITURE",
          supplier: inverseMap.supplier ? String(row[inverseMap.supplier] ?? "") || null : null,
          supplier_ref: inverseMap.supplier_ref ? String(row[inverseMap.supplier_ref] ?? "") || null : null,
          internal_code,
          brand: inverseMap.brand ? String(row[inverseMap.brand] ?? "") || null : null,
          notes: inverseMap.notes ? String(row[inverseMap.notes] ?? "") || null : null,
          ...(inverseMap.description
            ? { notes: String(row[inverseMap.description] ?? "") || null }
            : {}),
        };

        toProcess.push({ idx: rowIdx, record, lookupKey: internal_code ?? slug });
      }

      // Lookup existing
      const lookupKeys = toProcess.map((p) => p.lookupKey).filter(Boolean) as string[];
      let existing: any[] = [];
      if (lookupKeys.length && dedup_strategy !== "duplicate") {
        const { data: ex } = await supabase
          .from("catalog_material")
          .select("id, slug, internal_code")
          .eq("user_id", userId)
          .or(`slug.in.(${lookupKeys.map((k) => `"${k}"`).join(",")}),internal_code.in.(${lookupKeys.map((k) => `"${k}"`).join(",")})`);
        existing = ex ?? [];
      }
      const existingMap = new Map<string, string>();
      for (const e of existing) {
        if (e.slug) existingMap.set(e.slug, e.id);
        if (e.internal_code) existingMap.set(e.internal_code, e.id);
      }

      const toInsert: any[] = [];
      for (const p of toProcess) {
        const matchedId = p.lookupKey ? existingMap.get(p.lookupKey) : null;
        if (matchedId) {
          if (dedup_strategy === "skip") {
            skipped++;
          } else if (dedup_strategy === "update") {
            const { error } = await supabase.from("catalog_material").update(p.record).eq("id", matchedId);
            if (error) {
              errors++;
              errorDetails.push({ row: p.idx, message: error.message });
            } else {
              updated++;
            }
          } else {
            toInsert.push(p.record);
          }
        } else {
          toInsert.push(p.record);
        }
      }

      if (toInsert.length) {
        const { error, data } = await supabase.from("catalog_material").insert(toInsert).select("id");
        if (error) {
          errors += toInsert.length;
          errorDetails.push({ row: i + 2, message: error.message });
        } else {
          created += data?.length ?? 0;
        }
      }
    }

    await supabase
      .from("catalog_import_jobs")
      .update({
        status: "done",
        created_count: created,
        updated_count: updated,
        skipped_count: skipped,
        error_count: errors,
        errors: errorDetails.slice(0, 100),
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Lance la classification IA en arrière-plan (best-effort, non bloquant)
    let auto_classified = 0;
    try {
      const classifyRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/classify-catalog-ai`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope: "user", user_id: userId, limit: 500 }),
        },
      );
      if (classifyRes.ok) {
        const r = await classifyRes.json();
        auto_classified = r.processed ?? 0;
      }
    } catch (e) {
      console.warn("Auto-classify failed (non-blocking):", (e as Error).message);
    }

    return new Response(
      JSON.stringify({
        job_id: job.id,
        total: rows.length,
        created,
        updated,
        skipped,
        errors,
        auto_classified,
        error_details: errorDetails,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-catalog-csv error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
