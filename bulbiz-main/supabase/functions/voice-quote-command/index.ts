import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CurrentLine {
  id: string;
  label: string;
  qty: number;
  unit_price: number;
  vat_rate: number;
  type: string;
}

interface RequestBody {
  audio_base64: string;
  mime_type: string;
  quote_id?: string | null;
  current_lines: CurrentLine[];
  mode: "command" | "dictation" | "generate_full";
  dossier_id?: string | null;
}

const VOICE_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "interpret_voice_quote",
    description:
      "Interpret a French artisan voice command and return structured actions to apply on a quote",
    parameters: {
      type: "object",
      properties: {
        transcript: {
          type: "string",
          description: "Verbatim transcription of the user's speech in French",
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "add_line",
                  "update_line",
                  "delete_line",
                  "set_discount",
                  "set_vat",
                  "rename_quote",
                ],
              },
              confidence: { type: "number" },
              label: { type: "string" },
              description: { type: "string" },
              qty: { type: "number" },
              unit: { type: "string" },
              unit_price: { type: "number" },
              vat_rate: { type: "number" },
              line_type: {
                type: "string",
                enum: [
                  "standard",
                  "main_oeuvre",
                  "deplacement",
                  "materiel",
                  "fourniture",
                ],
              },
              line_ref: {
                type: "string",
                description:
                  "Existing line id OR fuzzy label match OR 'global' for whole quote",
              },
              field: {
                type: "string",
                enum: ["qty", "unit_price", "vat_rate", "label", "description", "discount"],
              },
              value: {},
              discount_unit: {
                type: "string",
                enum: ["EUR", "PERCENT"],
              },
              reason: { type: "string" },
            },
            required: ["type", "confidence"],
            additionalProperties: false,
          },
        },
        ambiguities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              candidates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    line_ref: { type: "string" },
                    label: { type: "string" },
                  },
                  required: ["line_ref", "label"],
                },
              },
            },
            required: ["question", "candidates"],
          },
        },
        needs_confirmation: { type: "boolean" },
        unmatched: { type: "string", description: "Parts of speech that could not be mapped" },
      },
      required: ["transcript", "actions", "ambiguities", "needs_confirmation"],
      additionalProperties: false,
    },
  },
} as const;

function buildSystemPrompt(mode: "command" | "dictation", lines: CurrentLine[]): string {
  const linesContext = lines.length
    ? `\n\nLignes actuelles du devis :\n${lines
        .map(
          (l, i) =>
            `${i + 1}. id="${l.id}" — "${l.label}" — ${l.qty} × ${l.unit_price}€ — TVA ${l.vat_rate}% — type=${l.type}`,
        )
        .join("\n")}`
    : "\n\nLe devis est vide.";

  const baseRules = `Tu es un assistant vocal pour artisans français qui édite un devis.
Tu dois TOUJOURS répondre via la fonction interpret_voice_quote.
Tu transcris d'abord la voix en français exact (transcript), puis tu extrais les actions.

RÈGLES :
- Quantités : "deux heures" → 2, unit "h" ; "trois mètres" → 3, unit "m"
- TVA : "TVA 10" → 10 ; "TVA 20" → 20 ; par défaut 10 sauf déplacement (20)
- Types de lignes :
  * "main d'œuvre", "heures", "h" → main_oeuvre
  * "déplacement", "trajet" → deplacement
  * "fourniture", "petit matériel", "raccords" → fourniture
  * "matériel", "mécanisme", "siphon", "tube" → materiel
  * autre → standard
- Prix : si non mentionné, mets 0 (sera complété par catalogue côté serveur)
- line_ref pour update/delete : utilise l'id exact d'une ligne existante. Si l'utilisateur dit "la ligne déplacement", "la dernière", "la ligne 2", trouve l'id correspondant. Sinon mets le label brut.
- Si plusieurs lignes correspondent à la référence, ajoute une entrée dans ambiguities avec needs_confirmation=true.
- Confiance < 0.7 si l'action est incertaine.
- N'invente PAS d'actions non demandées.
${linesContext}`;

  if (mode === "command") {
    return `${baseRules}

MODE COMMANDE STRUCTURÉE : extrais uniquement les actions explicites prononcées (ajoute, supprime, modifie, passe à, mets, renomme, remise...). Refuse les inventions.`;
  }

  return `${baseRules}

MODE DICTÉE LIBRE : l'utilisateur décrit une intervention en langage naturel. Infère les lignes nécessaires (main d'œuvre, fournitures, matériel) à partir de la description. Sois généreux mais reste fidèle à ce qui est dit.`;
}

async function transcribeAndInterpret(
  audioBase64: string,
  mimeType: string,
  mode: "command" | "dictation",
  currentLines: CurrentLine[],
): Promise<unknown> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5",
      messages: [
        { role: "system", content: buildSystemPrompt(mode, currentLines) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcris cet audio puis interprète les commandes vocales pour modifier le devis.",
            },
            {
              type: "input_audio",
              input_audio: {
                data: audioBase64,
                format: mimeType.includes("webm")
                  ? "webm"
                  : mimeType.includes("mp4") || mimeType.includes("m4a")
                    ? "mp4"
                    : "wav",
              },
            },
          ],
        },
      ],
      tools: [VOICE_TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "interpret_voice_quote" } },
    }),
  });

  if (response.status === 429) {
    throw new Response(
      JSON.stringify({ error: "rate_limited", message: "Trop de requêtes, réessayez dans 1 min" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (response.status === 402) {
    throw new Response(
      JSON.stringify({ error: "payment_required", message: "Crédits IA épuisés" }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!response.ok) {
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    throw new Error(`AI gateway error ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("No tool call returned by AI");
  }
  return JSON.parse(toolCall.function.arguments);
}

async function enrichWithCatalog(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  actions: any[],
): Promise<any[]> {
  const enriched: any[] = [];
  for (const a of actions) {
    if (a.type !== "add_line" || (a.unit_price && a.unit_price > 0)) {
      enriched.push(a);
      continue;
    }
    const { data } = await supabase
      .from("catalog_material")
      .select("label, unit, unit_price, vat_rate")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .ilike("label", `%${a.label}%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      enriched.push({
        ...a,
        unit_price: a.unit_price || Number(data.unit_price) || 0,
        unit: a.unit || data.unit || "u",
        vat_rate: a.vat_rate || Number(data.vat_rate) || 10,
        source: "catalog",
      });
    } else {
      enriched.push({ ...a, source: "ai_fallback" });
    }
  }
  return enriched;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    if (!body.audio_base64 || !body.mime_type) {
      return new Response(JSON.stringify({ error: "Missing audio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mode = body.mode || "command";

    // ===== MODE generate_full =====
    // Transcrit la note vocale puis délègue à generate-ai-quote-draft pour produire un pré-devis complet.
    if (mode === "generate_full") {
      if (!body.dossier_id) {
        return new Response(JSON.stringify({ error: "dossier_id required for generate_full mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // 1) transcription seule via Gemini
      const transcriptResult: any = await transcribeAndInterpret(
        body.audio_base64,
        body.mime_type,
        "dictation",
        [],
      );
      const transcript = transcriptResult?.transcript || "";

      // 2) appel de generate-ai-quote-draft avec la transcription en consigne principale
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const draftResp = await fetch(`${supabaseUrl}/functions/v1/generate-ai-quote-draft`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dossier_id: body.dossier_id,
          quote_id: body.quote_id ?? null,
          voice_transcript: transcript,
        }),
      });

      const draftJson = await draftResp.json().catch(() => ({}));
      if (!draftResp.ok) {
        return new Response(JSON.stringify({
          error: draftJson?.error || `draft ${draftResp.status}`,
          transcript,
        }), {
          status: draftResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ transcript, draft: draftJson }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result: any = await transcribeAndInterpret(
      body.audio_base64,
      body.mime_type,
      mode as "command" | "dictation",
      body.current_lines || [],
    );

    // Normalize actions: rename discount_unit → unit for set_discount; ensure ids
    const rawActions = Array.isArray(result.actions) ? result.actions : [];
    const normalized = rawActions.map((a: any) => {
      const base = { ...a, id: crypto.randomUUID(), accepted: true };
      if (a.type === "set_discount" && a.discount_unit) {
        base.unit = a.discount_unit;
        delete base.discount_unit;
      }
      return base;
    });

    const enriched = await enrichWithCatalog(supabase, userData.user.id, normalized);

    return new Response(
      JSON.stringify({
        transcript: result.transcript || "",
        actions: enriched,
        ambiguities: result.ambiguities || [],
        needs_confirmation: !!result.needs_confirmation,
        unmatched: result.unmatched || "",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("voice-quote-command error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
