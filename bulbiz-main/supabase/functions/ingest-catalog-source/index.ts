import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface NormalizedItem {
  raw_name: string;
  label: string;
  unit?: string;
  unit_price?: number;
  vat_rate?: number;
  brand?: string;
  supplier?: string;
  supplier_ref?: string;
  category_path?: string;
  source_external_id?: string;
  source_url?: string;
  confidence_score?: number;
  type?: string;
}

/** Parses simple CSV text into rows. */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeCsvRow(row: Record<string, string>, sourceUrl?: string): NormalizedItem | null {
  const label = pick(row, ["label", "name", "nom", "designation", "produit", "article"]);
  if (!label) return null;
  const priceStr = pick(row, ["unit_price", "price", "prix", "prix_ht", "ht"]);
  const vatStr = pick(row, ["vat_rate", "tva", "tva_rate"]);
  const qtyUnit = pick(row, ["unit", "unite", "u"]) ?? "u";
  return {
    raw_name: label,
    label: label.slice(0, 200),
    unit: qtyUnit,
    unit_price: priceStr ? parseFloat(priceStr.replace(",", ".").replace(/[^\d.]/g, "")) || 0 : 0,
    vat_rate: vatStr ? parseFloat(vatStr.replace(",", ".")) || 20 : 20,
    brand: pick(row, ["brand", "marque"]),
    supplier: pick(row, ["supplier", "fournisseur"]),
    supplier_ref: pick(row, ["ref", "reference", "supplier_ref", "code"]),
    category_path: pick(row, ["category", "categorie", "category_path"]) ?? "Divers",
    source_external_id: pick(row, ["id", "external_id", "sku"]),
    source_url: sourceUrl,
    confidence_score: 0.9,
    type: "PETITE_FOURNITURE",
  };
}

async function ingestCsvFromUrl(url: string): Promise<NormalizedItem[]> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`CSV fetch failed: ${resp.status}`);
  const text = await resp.text();
  const rows = parseCSV(text);
  return rows.map((r) => normalizeCsvRow(r, url)).filter((x): x is NormalizedItem => x !== null);
}

/** Very basic web scraper using Firecrawl if available, else falls back to plain HTML extraction. */
async function ingestWebsite(url: string): Promise<NormalizedItem[]> {
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (fcKey) {
    try {
      const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fcKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: [
            {
              type: "json",
              prompt:
                "Extract a list of construction/plumbing products from this page as JSON array under key 'products'. Each item: {label, brand, unit_price (number, EUR HT), unit, supplier_ref, category_path}.",
            },
          ],
          onlyMainContent: true,
        }),
      });
      const json = await resp.json();
      const products: any[] =
        json?.data?.json?.products ?? json?.json?.products ?? json?.data?.products ?? [];
      return products
        .filter((p) => p?.label)
        .map((p) => ({
          raw_name: String(p.label),
          label: String(p.label).slice(0, 200),
          unit: p.unit ?? "u",
          unit_price: typeof p.unit_price === "number" ? p.unit_price : 0,
          vat_rate: 20,
          brand: p.brand,
          supplier_ref: p.supplier_ref,
          category_path: p.category_path ?? "Divers",
          source_url: url,
          confidence_score: 0.7,
          type: "PETITE_FOURNITURE",
        })) as NormalizedItem[];
    } catch (e) {
      console.error("Firecrawl failed", e);
    }
  }
  // No firecrawl: just return empty
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Réservé aux admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { source_id } = await req.json();
    if (!source_id) throw new Error("source_id requis");

    const { data: source, error: srcErr } = await admin
      .from("data_sources")
      .select("*")
      .eq("id", source_id)
      .maybeSingle();
    if (srcErr || !source) throw new Error("Source introuvable");

    // Create job
    const { data: job, error: jobErr } = await admin
      .from("ingestion_jobs")
      .insert({
        data_source_id: source_id,
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: userId,
      })
      .select()
      .single();
    if (jobErr) throw jobErr;

    await admin
      .from("data_sources")
      .update({ status: "running", last_sync_at: new Date().toISOString() })
      .eq("id", source_id);

    let items: NormalizedItem[] = [];
    let runErr: string | null = null;

    try {
      if (source.source_type === "csv" && source.base_url) {
        items = await ingestCsvFromUrl(source.base_url);
      } else if (
        (source.source_type === "website" || source.source_type === "firecrawl") &&
        source.base_url
      ) {
        items = await ingestWebsite(source.base_url);
      } else if (source.source_type === "manual") {
        // Manual: nothing to ingest, just acknowledge
        items = [];
      } else {
        throw new Error(`Type de source non supporté pour ingestion automatique : ${source.source_type}`);
      }
    } catch (e: any) {
      runErr = e.message ?? String(e);
    }

    let created = 0;
    let updated = 0;
    let flagged = 0;
    const errors: any[] = runErr ? [{ message: runErr }] : [];

    // Upsert items into catalog_material
    for (const it of items) {
      try {
        const slug = slugify(it.label);
        // Dedup by source_external_id+source_id, else by slug+source_id
        let query = admin.from("catalog_material").select("id").eq("source_id", source_id).limit(1);
        if (it.source_external_id) {
          query = query.eq("source_external_id", it.source_external_id);
        } else {
          query = query.eq("slug", slug);
        }
        const { data: existing } = await query.maybeSingle();

        const payload = {
          source_id,
          source_url: it.source_url ?? source.base_url,
          source_external_id: it.source_external_id ?? null,
          raw_name: it.raw_name,
          label: it.label,
          slug,
          brand: it.brand ?? null,
          supplier: it.supplier ?? null,
          supplier_ref: it.supplier_ref ?? null,
          category_path: it.category_path ?? "Divers",
          unit: it.unit ?? "u",
          unit_price: it.unit_price ?? 0,
          vat_rate: it.vat_rate ?? 20,
          confidence_score: it.confidence_score ?? 0.5,
          type: it.type ?? "PETITE_FOURNITURE",
          active: true,
          user_id: null,
        };

        if (existing) {
          const { error } = await admin.from("catalog_material").update(payload).eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await admin.from("catalog_material").insert(payload);
          if (error) throw error;
          created++;
        }
        if ((it.confidence_score ?? 1) < 0.6) flagged++;
      } catch (e: any) {
        errors.push({ item: it.raw_name, error: e.message ?? String(e) });
      }
    }

    const finalStatus = runErr ? "failed" : errors.length > 0 ? "partial" : "completed";
    await admin
      .from("ingestion_jobs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        items_found: items.length,
        items_created: created,
        items_updated: updated,
        items_flagged: flagged,
        errors_json: errors,
      })
      .eq("id", job.id);

    await admin
      .from("data_sources")
      .update({
        status: finalStatus === "failed" ? "error" : "idle",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", source_id);

    return new Response(
      JSON.stringify({
        job_id: job.id,
        status: finalStatus,
        items_found: items.length,
        items_created: created,
        items_updated: updated,
        items_flagged: flagged,
        errors: errors.slice(0, 5),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("ingest-catalog-source error", e);
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
