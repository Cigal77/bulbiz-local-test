import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Sector {
  id: string;
  slug: string;
  name: string;
}

interface Category {
  id: string;
  sector_id: string;
  slug: string;
  name: string;
}

interface Material {
  id: string;
  label: string;
  category_path: string | null;
  subcategory: string | null;
  type: string | null;
  brand: string | null;
  notes: string | null;
  sector_id: string | null;
  category_id: string | null;
}

interface AISuggestion {
  primary_sector_slug: string;
  secondary_sector_slugs: string[];
  category_slug: string | null;
  subcategory: string | null;
  tags: string[];
  synonyms: string[];
  confidence: number;
  reasoning?: string;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristique fallback pour classer rapidement à partir du category_path
 * sans appel IA. Garantit qu'aucun article ne reste sans secteur principal.
 */
function heuristicClassify(
  m: Material,
  sectors: Sector[],
): { primary: string; secondary: string[] } {
  const bySlug = new Map(sectors.map((s) => [s.slug, s.id]));
  const path = (m.category_path ?? "").toLowerCase();
  const label = (m.label ?? "").toLowerCase();
  const text = `${path} ${label}`;

  const has = (re: RegExp) => re.test(text);

  // WC, lavabo, douche, baignoire → Sanitaire principal
  if (has(/\b(wc|cuvette|abattant|réservoir|reservoir|bâti|bati|lavabo|vasque|douche|baignoire|mitigeur|robinet)\b/)) {
    return { primary: bySlug.get("sanitaire") ?? sectors[0].id, secondary: [] };
  }
  // Siphon, bonde, évacuation → Évacuation principal (multi)
  if (has(/\b(siphon|bonde|évacuation|evacuation|pipe wc|pvc)\b/)) {
    const secondaries = ["plomberie", "sanitaire"]
      .map((s) => bySlug.get(s))
      .filter(Boolean) as string[];
    return { primary: bySlug.get("evacuation") ?? sectors[0].id, secondary: secondaries };
  }
  // Tube, raccord, vanne, cuivre → Plomberie
  if (has(/\b(tube|raccord|cuivre|per|multicouche|vanne|robinet d'arrêt|robinet d'arret|flexible|téflon|teflon)\b/)) {
    return { primary: bySlug.get("plomberie") ?? sectors[0].id, secondary: [] };
  }
  // Chauffe-eau → Eau chaude
  if (has(/\b(chauffe-eau|chauffe eau|cumulus|ballon|anode|résistance|resistance|groupe de sécurité)\b/)) {
    return { primary: bySlug.get("eau-chaude") ?? sectors[0].id, secondary: [] };
  }
  // Chaudière, radiateur → Chauffage
  if (has(/\b(chaudière|chaudiere|radiateur|thermostatique|expansion|circulateur)\b/)) {
    return { primary: bySlug.get("chauffage") ?? sectors[0].id, secondary: [] };
  }
  // Câble, disjoncteur, prise → Électricité
  if (has(/\b(câble|cable|disjoncteur|prise|interrupteur|gaine|tableau électrique|tableau electrique)\b/)) {
    return { primary: bySlug.get("electricite") ?? sectors[0].id, secondary: [] };
  }
  // VMC, gaine, bouche → Ventilation
  if (has(/\b(vmc|bouche d'extraction|ventilation|gaine flex)\b/)) {
    return { primary: bySlug.get("ventilation") ?? sectors[0].id, secondary: [] };
  }
  // Fixation, vis, cheville, collier → Fixation
  if (has(/\b(vis|cheville|collier|rail|fixation|support|ancrage)\b/)) {
    return { primary: bySlug.get("fixation") ?? sectors[0].id, secondary: [] };
  }
  // Joint, silicone, mastic, téflon → Consommables
  if (has(/\b(joint|silicone|mastic|colle|filasse|ruban)\b/)) {
    return { primary: bySlug.get("consommables") ?? sectors[0].id, secondary: [] };
  }
  // Default
  return { primary: bySlug.get("plomberie") ?? sectors[0].id, secondary: [] };
}

async function classifyBatchWithAI(
  materials: Material[],
  sectors: Sector[],
  categories: Category[],
  apiKey: string,
): Promise<Map<string, AISuggestion>> {
  const sectorList = sectors.map((s) => `- ${s.slug}: ${s.name}`).join("\n");
  const categoryList = categories
    .map((c) => {
      const sector = sectors.find((s) => s.id === c.sector_id);
      return `- ${c.slug} (secteur ${sector?.slug ?? "?"}): ${c.name}`;
    })
    .join("\n");

  const items = materials.map((m) => ({
    id: m.id,
    label: m.label,
    category_path: m.category_path,
    type: m.type,
    brand: m.brand,
  }));

  const systemPrompt = `Tu es un expert classification produits BTP français (plomberie, sanitaire, chauffage, électricité). Tu reçois une liste d'articles et tu dois assigner pour chacun :
- primary_sector_slug : le secteur principal (UN seul, slug exact de la liste)
- secondary_sector_slugs : 0 à 3 secteurs secondaires si l'article peut servir dans plusieurs métiers (ex: un siphon = principal "evacuation", secondaires ["plomberie", "sanitaire"])
- category_slug : la catégorie de niveau 2 si elle correspond (slug exact ou null)
- subcategory : sous-catégorie libre courte (ex: "Tube cuivre Ø14") ou null
- tags : 2-5 mots-clés utiles à la recherche (lowercase, sans accents)
- synonyms : 0-3 synonymes français usuels (lowercase, sans accents)
- confidence : 0.0 à 1.0

SECTEURS DISPONIBLES :
${sectorList}

CATÉGORIES DISPONIBLES :
${categoryList}

Réponds UNIQUEMENT en appelant la fonction classify_items.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Classe ces articles :\n${JSON.stringify(items, null, 2)}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify_items",
            description: "Retourne la classification de chaque article",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      primary_sector_slug: { type: "string" },
                      secondary_sector_slugs: { type: "array", items: { type: "string" } },
                      category_slug: { type: ["string", "null"] },
                      subcategory: { type: ["string", "null"] },
                      tags: { type: "array", items: { type: "string" } },
                      synonyms: { type: "array", items: { type: "string" } },
                      confidence: { type: "number" },
                    },
                    required: ["id", "primary_sector_slug", "secondary_sector_slugs", "tags", "confidence"],
                  },
                },
              },
              required: ["classifications"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify_items" } },
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`AI gateway ${response.status}: ${txt.slice(0, 200)}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("No tool call in AI response");
  }
  const parsed = JSON.parse(toolCall.function.arguments);
  const result = new Map<string, AISuggestion>();
  for (const c of parsed.classifications ?? []) {
    result.set(c.id, {
      primary_sector_slug: c.primary_sector_slug,
      secondary_sector_slugs: c.secondary_sector_slugs ?? [],
      category_slug: c.category_slug ?? null,
      subcategory: c.subcategory ?? null,
      tags: c.tags ?? [],
      synonyms: c.synonyms ?? [],
      confidence: c.confidence ?? 0.5,
    });
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérifier admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const force: boolean = !!body.force;
    const scope: "bulbiz" | "all" | "user" = body.scope ?? "bulbiz";
    const targetUserId: string | null = body.user_id ?? null;
    const limit: number = Math.min(body.limit ?? 1000, 1000);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Charger taxonomie
    const { data: sectors } = await supabase
      .from("product_sectors")
      .select("id, slug, name")
      .eq("active", true)
      .order("sort_order");
    const { data: categories } = await supabase
      .from("product_categories")
      .select("id, sector_id, slug, name");

    if (!sectors?.length) throw new Error("No sectors defined");

    // Charger articles à classer
    let q = supabase
      .from("catalog_material")
      .select("id, label, category_path, subcategory, type, brand, notes, sector_id, category_id, user_id")
      .eq("active", true)
      .limit(limit);

    if (scope === "bulbiz") q = q.is("user_id", null);
    else if (scope === "user" && targetUserId) q = q.eq("user_id", targetUserId);
    if (!force) q = q.is("sector_id", null);

    const { data: materials, error: mErr } = await q;
    if (mErr) throw mErr;
    if (!materials?.length) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "Aucun article à classer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const slugToSectorId = new Map(sectors.map((s) => [s.slug, s.id]));
    const slugToCategoryId = new Map(categories?.map((c) => [c.slug, c.id]) ?? []);

    let processed = 0;
    let aiClassified = 0;
    let heuristicClassified = 0;
    const failures: string[] = [];

    const BATCH = 25;
    for (let i = 0; i < materials.length; i += BATCH) {
      const slice = materials.slice(i, i + BATCH);

      let aiResults: Map<string, AISuggestion> = new Map();
      try {
        aiResults = await classifyBatchWithAI(slice, sectors, categories ?? [], apiKey);
      } catch (e) {
        console.error("AI batch failed", (e as Error).message);
        failures.push(`batch ${i}: ${(e as Error).message}`);
      }

      for (const m of slice) {
        const ai = aiResults.get(m.id);
        let primarySectorId: string | null = null;
        let secondarySectorIds: string[] = [];
        let categoryId: string | null = null;
        let subcategory: string | null = m.subcategory;
        let tags: string[] = [];
        let synonyms: string[] = [];
        let confidence = 0;
        let reasoning = "";

        if (ai && slugToSectorId.has(ai.primary_sector_slug)) {
          primarySectorId = slugToSectorId.get(ai.primary_sector_slug)!;
          secondarySectorIds = (ai.secondary_sector_slugs ?? [])
            .map((s) => slugToSectorId.get(s))
            .filter((id): id is string => !!id && id !== primarySectorId);
          if (ai.category_slug) categoryId = slugToCategoryId.get(ai.category_slug) ?? null;
          subcategory = ai.subcategory ?? subcategory;
          tags = ai.tags ?? [];
          synonyms = ai.synonyms ?? [];
          confidence = ai.confidence ?? 0.5;
          reasoning = "AI classification";
          aiClassified++;
        } else {
          // Fallback heuristique
          const heur = heuristicClassify(m, sectors);
          primarySectorId = heur.primary;
          secondarySectorIds = heur.secondary;
          confidence = 0.3;
          reasoning = "Heuristic fallback";
          heuristicClassified++;
        }

        const updates: any = {
          sector_id: primarySectorId,
          secondary_sector_ids: secondarySectorIds,
          normalized_name: normalizeName(m.label),
        };
        if (categoryId) updates.category_id = categoryId;
        if (subcategory) updates.subcategory = subcategory;
        if (tags.length) updates.tags = tags;
        if (synonyms.length) updates.synonyms = synonyms;

        const { error: upErr } = await supabase
          .from("catalog_material")
          .update(updates)
          .eq("id", m.id);

        if (upErr) {
          failures.push(`${m.id}: ${upErr.message}`);
          continue;
        }

        await supabase.from("product_classification_audit").insert({
          material_id: m.id,
          old_sector_id: m.sector_id,
          old_category_id: m.category_id,
          old_category_path: m.category_path,
          suggested_primary_sector_id: primarySectorId,
          suggested_secondary_sector_ids: secondarySectorIds,
          suggested_category_id: categoryId,
          suggested_subcategory: subcategory,
          suggested_tags: tags,
          suggested_synonyms: synonyms,
          confidence,
          reasoning,
          review_status: "applied",
          applied_at: new Date().toISOString(),
        });

        processed++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        ai_classified: aiClassified,
        heuristic_classified: heuristicClassified,
        total_candidates: materials.length,
        failures: failures.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("classify-catalog-ai error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});