// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface AiLineRaw {
  label: string;
  description?: string;
  qty: number;
  unit: string;
  estimated_price: number;
  vat_rate?: number;
  type: "main_oeuvre" | "deplacement" | "materiel" | "fourniture" | "standard";
  rationale?: string;
  voice_evidence?: string;
}

interface AiPayload {
  title: string;
  summary: string;
  confidence: number;
  lines: AiLineRaw[];
  assumptions: string[];
  missing_questions: string[];
  detected_from_photos?: {
    photo_name: string;
    material_label: string;
    brand?: string;
    model_or_ref?: string;
    visible_state: string;
    dimensions?: string;
  }[];
  variants?: { label: string; description?: string; lines: AiLineRaw[] }[];
}

function normLabel(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toAudioMime(fileType: string): string {
  if (fileType.includes("webm")) return "audio/webm";
  if (fileType.includes("mp4") || fileType.includes("m4a")) return "audio/mp4";
  if (fileType.includes("ogg")) return "audio/ogg";
  if (fileType.includes("wav")) return "audio/wav";
  if (fileType.includes("mp3") || fileType.includes("mpeg")) return "audio/mpeg";
  return fileType.startsWith("audio/") ? fileType : "audio/webm";
}

function toImageMime(fileType: string): string {
  if (fileType.includes("jpeg") || fileType.includes("jpg")) return "image/jpeg";
  if (fileType.includes("png")) return "image/png";
  if (fileType.includes("webp")) return "image/webp";
  if (fileType.includes("gif")) return "image/gif";
  if (fileType.includes("heic")) return "image/heic";
  return fileType.startsWith("image/") ? fileType : "image/jpeg";
}

function toPublicMediaUrl(fileUrl: string): string {
  return fileUrl.startsWith("http")
    ? fileUrl
    : `${SUPABASE_URL}/storage/v1/object/public/dossier-medias/${fileUrl}`;
}

async function downloadAudioAsBase64(
  fileUrl: string,
  fileType: string,
  fileName: string,
  createdAt: string,
  maxSizeMB: number,
): Promise<{ base64: string; mimeType: string; name: string; date: string } | null> {
  try {
    const url = toPublicMediaUrl(fileUrl);
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.arrayBuffer();
    if (blob.byteLength > maxSizeMB * 1024 * 1024) return null;
    const base64 = base64Encode(new Uint8Array(blob));
    return { base64, mimeType: fileType, name: fileName, date: createdAt };
  } catch (e) {
    console.error("download failed", fileName, e);
    return null;
  }
}

async function downloadImageAsBase64(
  fileUrl: string,
  fileType: string,
  fileName: string,
  createdAt: string,
  maxSizeMB: number,
): Promise<{ base64: string; mimeType: string; name: string; date: string } | null> {
  try {
    const url = toPublicMediaUrl(fileUrl);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[generate-ai-quote-draft] image HTTP ${resp.status} for ${fileName}`);
      return null;
    }
    const blob = await resp.arrayBuffer();
    if (blob.byteLength > maxSizeMB * 1024 * 1024) {
      console.warn(`[generate-ai-quote-draft] image ${fileName} skipped (>${maxSizeMB}MB)`);
      return null;
    }
    const base64 = base64Encode(new Uint8Array(blob));
    return { base64, mimeType: toImageMime(fileType), name: fileName, date: createdAt };
  } catch (e) {
    console.error("[generate-ai-quote-draft] image download failed", fileName, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const dossier_id = body?.dossier_id as string | undefined;
    const quote_id = (body?.quote_id as string | null) ?? null;
    const voice_transcript = (body?.voice_transcript as string | undefined) ?? "";
    const force_refresh = !!body?.force;
    if (!dossier_id) {
      return new Response(JSON.stringify({ error: "dossier_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Dossier complet
    const { data: dossier, error: dossierErr } = await admin
      .from("dossiers")
      .select(
        "id, user_id, category, urgency, description, address, address_line, postal_code, city, client_first_name, client_last_name, client_phone, client_email, problem_types, trade_types, housing_type, floor_number, has_elevator, occupant_type, access_code, availability",
      )
      .eq("id", dossier_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (dossierErr || !dossier) {
      return new Response(JSON.stringify({ error: "Dossier introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Tout en parallèle : historique, médias, devis passés, catalogue, cache résumé
    const [histRes, audioRes, imageRes, noteRes, pastQuotesRes, catalogRes, cacheRes] = await Promise.all([
      admin.from("historique").select("action, details, created_at")
        .eq("dossier_id", dossier_id).order("created_at", { ascending: false }).limit(20),
      admin.from("medias").select("file_url, file_type, file_name, created_at")
        .eq("dossier_id", dossier_id).like("file_type", "audio/%")
        .order("created_at", { ascending: false }).limit(20),
      admin.from("medias").select("file_url, file_type, file_name, created_at")
        .eq("dossier_id", dossier_id).like("file_type", "image/%")
        .order("created_at", { ascending: false }).limit(20),
      admin.from("medias").select("file_url, file_name, created_at")
        .eq("dossier_id", dossier_id).eq("media_category", "note")
        .order("created_at", { ascending: false }).limit(20),
      admin.from("quotes").select("quote_number, total_ht, items, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      admin.from("catalog_material")
        .select("id, label, type, unit, unit_price, vat_rate, tags, synonyms, category_path")
        .or(`user_id.is.null,user_id.eq.${user.id}`).limit(400),
      admin.from("ai_summary_cache").select("summary_json").eq("dossier_id", dossier_id).maybeSingle(),
    ]);

    const notes = histRes.data ?? [];
    const audioMedias = audioRes.data ?? [];
    const imageMedias = imageRes.data ?? [];
    const noteMedias = noteRes.data ?? [];
    const pastQuotes = pastQuotesRes.data ?? [];
    const catalog = catalogRes.data ?? [];
    const cachedSummary = (cacheRes.data?.summary_json as any) ?? null;

    // If the caller asked to bypass cache, regenerate the dossier summary now
    // so that a freshly added voice note / photo is taken into account.
    let effectiveSummary = cachedSummary;
    if (force_refresh) {
      try {
        const sumResp = await fetch(`${SUPABASE_URL}/functions/v1/summarize-dossier`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dossier_id, force: true }),
        });
        if (sumResp.ok) {
          effectiveSummary = await sumResp.json();
          console.log("[generate-ai-quote-draft] summary refreshed (force)");
        } else {
          console.warn("[generate-ai-quote-draft] summary refresh failed:", sumResp.status);
        }
      } catch (e) {
        console.error("[generate-ai-quote-draft] summary refresh error:", e);
      }
    }

    // 3) Préparation médias : audio + images téléchargés en base64 pour Gemini (inline_data)
    const [audioResults, imageResults] = await Promise.all([
      Promise.all(audioMedias.map((m) =>
        downloadAudioAsBase64(m.file_url, m.file_type, m.file_name, m.created_at, 3))),
      Promise.all(imageMedias.map((m) =>
        downloadImageAsBase64(m.file_url, m.file_type, m.file_name, m.created_at, 4))),
    ]);
    const validAudios = audioResults.filter(Boolean) as NonNullable<typeof audioResults[number]>[];
    const validImages = imageResults.filter(Boolean) as NonNullable<typeof imageResults[number]>[];

    // 4) Construction du contexte texte
    const noteText = notes
      .filter((n) => !!n.details)
      .slice(0, 25)
      .map((n) => `- [${n.created_at.slice(0, 16)}] ${n.details ?? n.action}`)
      .join("\n");

    const writtenNotesText = [
      ...notes
        .filter((n) => n.action === "note" || n.action === "note_added")
        .map((n) => `- [${n.created_at.slice(0, 16)}] ${n.details ?? "Note artisan"}`),
      ...noteMedias.map((n) => `- [${n.created_at.slice(0, 16)}] ${n.file_name}`),
    ]
      .filter(Boolean)
      .join("\n");

    const pastSummaries = pastQuotes
      .map((q: any) => {
        const lines = Array.isArray(q.items)
          ? q.items.slice(0, 4).map((i: any) => i?.label).filter(Boolean).join(", ")
          : "";
        return `- ${q.quote_number} (${Number(q.total_ht ?? 0).toFixed(0)}€) : ${lines}`;
      })
      .join("\n");

    let cacheBlock = "";
    if (effectiveSummary) {
      const headline = effectiveSummary.headline ? `Résumé : ${effectiveSummary.headline}\n` : "";
      const bullets = Array.isArray(effectiveSummary.bullets)
        ? effectiveSummary.bullets.map((b: string) => `- ${b}`).join("\n") + "\n"
        : "";
      const mat = Array.isArray(effectiveSummary.material_list) && effectiveSummary.material_list.length > 0
        ? "Matériel déjà identifié dans le dossier :\n" +
          effectiveSummary.material_list
            .map((m: any) => `- ${m.label} (${m.qty ?? 1} ${m.unit ?? "u"}${m.ref ? ", ref " + m.ref : ""})`)
            .join("\n")
        : "";
      cacheBlock = `\n\n🧠 SYNTHÈSE MULTIMODALE PRÉ-CALCULÉE :\n${headline}${bullets}${mat}`;
    }

    // === Verbatim voice notes from the dossier (artisan + client) ===
    // Source of truth for what was actually said. Inject prominently at the top
    // of the prompt so the model treats them as binding instructions.
    const cachedTranscripts: { name: string; date: string; text: string }[] = Array.isArray(effectiveSummary?.voice_transcripts)
      ? effectiveSummary.voice_transcripts
      : [];
    const dossierVoiceBlock = cachedTranscripts.length > 0
      ? `\n\n🎙️ TRANSCRIPTIONS VERBATIM DES NOTES VOCALES DU DOSSIER (${cachedTranscripts.length}) — SOURCE DE VÉRITÉ :\n` +
        cachedTranscripts
          .map((t, i) => `[Note ${i + 1} · ${t.date.slice(0, 16)} · ${t.name}]\n"""\n${t.text}\n"""`)
          .join("\n\n")
      : "";

    const voiceBlock = voice_transcript
      ? `\n\n🎙️ NOTE VOCALE DICTÉE PAR L'ARTISAN POUR CE PRÉ-DEVIS :\n"""\n${voice_transcript}\n"""`
      : "";

    const contextText = `DOSSIER #${dossier.id.slice(0, 8)}

👤 CLIENT
Nom: ${[dossier.client_first_name, dossier.client_last_name].filter(Boolean).join(" ") || "—"}
Tél: ${dossier.client_phone || "—"} | Email: ${dossier.client_email || "—"}
Disponibilités: ${dossier.availability || "—"}

📍 CHANTIER
Adresse: ${dossier.address || "—"}
${dossier.address_line || ""} ${dossier.postal_code || ""} ${dossier.city || ""}
Logement: ${dossier.housing_type || "—"} | Étage: ${dossier.floor_number ?? "?"} | Ascenseur: ${dossier.has_elevator === true ? "oui" : dossier.has_elevator === false ? "non" : "?"}
Code accès: ${dossier.access_code || "—"} | Occupant: ${dossier.occupant_type || "—"}

🔧 PROBLÈME
Catégorie: ${dossier.category} | Urgence: ${dossier.urgency}
Métiers: ${(dossier.trade_types ?? []).join(", ") || "—"}
Types de problème: ${(dossier.problem_types ?? []).join(", ") || "—"}
Description: ${dossier.description || "—"}

📜 NOTES & ÉCHANGES (historique) :
${noteText || "(aucune)"}

✏️ NOTES ÉCRITES DE L'ARTISAN (${noteMedias.length}) :
${writtenNotesText || "(aucune)"}

📷 PHOTOS JOINTES : ${validImages.length} (analysées ci-dessous)
🎙️ NOTES VOCALES JOINTES : ${validAudios.length} (transcrites et analysées ci-dessous)

📋 HISTORIQUE DES 5 DERNIERS DEVIS DE CET ARTISAN (référence prix/structure) :
${pastSummaries || "(aucun)"}${cacheBlock}${dossierVoiceBlock}${voiceBlock}

Génère un PRÉ-DEVIS structuré et réaliste basé sur l'ANALYSE COMPLÈTE de ces données (texte + photos + audio).`;

    // 5) Construction des parts multimodales
    const userParts: any[] = [{ type: "text", text: contextText }];

    if (validImages.length > 0) {
      userParts.push({ type: "text", text: `\n📷 PHOTOS DU CHANTIER :` });
      for (const img of validImages) {
        if (!img?.base64) {
          console.warn(`[generate-ai-quote-draft] skipping image without base64: ${img?.name}`);
          continue;
        }
        userParts.push({ type: "text", text: `[Photo "${img.name}" du ${img.date.slice(0, 16)}]` });
        userParts.push({
          type: "image_url",
          image_url: { url: `data:${toImageMime(img.mimeType)};base64,${img.base64}` },
        });
        console.log(`[generate-ai-quote-draft] image prepared name="${img.name}" b64_len=${img.base64.length}`);
      }
    }

    if (validAudios.length > 0) {
      userParts.push({ type: "text", text: `\n🎙️ NOTES VOCALES DU DOSSIER (transcris-les MOT À MOT puis utilise leur contenu pour le pré-devis) :` });
      for (const a of validAudios) {
        if (!a?.base64) {
          console.warn(`[generate-ai-quote-draft] skipping audio without base64: ${a?.name}`);
          continue;
        }
        const mime = toAudioMime(a.mimeType);
        const fmt = mime.includes("mp4") || mime.includes("m4a") ? "mp4"
          : mime.includes("wav") ? "wav"
          : mime.includes("mp3") || mime.includes("mpeg") ? "mp3"
          : mime.includes("ogg") ? "ogg"
          : "webm";
        userParts.push({ type: "text", text: `[Note vocale "${a.name}" du ${a.date.slice(0, 16)}] :` });
        userParts.push({
          type: "input_audio",
          input_audio: { data: a.base64, format: fmt },
        });
        console.log(`[generate-ai-quote-draft] audio prepared name="${a.name}" mime="${mime}" fmt="${fmt}" b64_len=${a.base64.length}`);
      }
    }

    // Garde-fou : audios déclarés mais aucun téléchargé
    if (audioMedias.length > 0 && validAudios.length === 0) {
      console.warn(`[generate-ai-quote-draft] ${audioMedias.length} audio(s) trouvé(s) mais aucun téléchargé (signed URL ? > 8MB ?)`);
    }

    const systemPrompt = `Tu es un expert artisan plombier/BTP français qui produit des PRÉ-DEVIS opérationnels.

ANALYSE MULTIMODALE OBLIGATOIRE — TU DOIS LITTÉRALEMENT :
1. Pour CHAQUE PHOTO fournie (TOUTES, pas seulement la 1ère) : décris ce que tu vois (équipement, marque/modèle visible, état, dimensions estimées, défaut). Remplis le champ structuré "detected_from_photos" avec UNE entrée par photo, dans le même ordre. Si rien n'est identifiable, mets material_label="Photo non exploitable" et explique pourquoi dans visible_state.
2. Pour CHAQUE NOTE VOCALE fournie (TOUTES, pas seulement la dernière) : la transcription verbatim est DÉJÀ fournie ci-dessus dans la section "🎙️ TRANSCRIPTIONS VERBATIM DES NOTES VOCALES DU DOSSIER". C'est ta SOURCE DE VÉRITÉ. Tu DOIS lire chaque transcription dans son intégralité et générer une ligne pour chaque élément factuel cité (matériel, marque, durée, prix annoncé). Pour CHAQUE ligne issue d'une note vocale, remplis le champ "voice_evidence" avec la phrase exacte (issue de la note vocale CONCERNÉE) qui justifie la ligne. Une note vocale plus ancienne reste pleinement valable tant qu'elle figure dans la liste : ne l'écarte JAMAIS au prétexte qu'une note plus récente existe.
3. Intègre TOUTES les notes écrites, l'historique complet, la description du dossier. Aucune source n'est optionnelle : si elle est listée, elle compte.
4. Si une note vocale dictée est fournie en bloc texte (voice_transcript), considère-la comme la consigne PRINCIPALE de l'artisan.
5. Si une synthèse multimodale (cache) est fournie, utilise-la comme base de vérité complémentaire — pas en remplacement de tes propres écoute/lecture.

RÈGLES DEVIS :
- Prix HT typiques marché français BTP/plomberie.
- "main_oeuvre" en heures (h), 55-75€/h.
- "deplacement" en forfait, 30-50€.
- TVA : 10% rénovation logement >2 ans, 20% neuf/matériel, 5,5% économie d'énergie.
- Si infos critiques manquent (dimensions, modèle exact…), mets-les dans missing_questions et baisse la confidence.
- Confidence : 0,8+ dossier riche (photos + audio + notes), 0,4-0,7 moyen, <0,4 très pauvre.
- Variantes uniquement si pertinent (réparation vs remplacement).

⚠️ N'invente AUCUNE info absente des sources. Si tu déduis depuis une photo, cite-le dans rationale (ex: "Visible sur photo IMG_2031 : mécanisme Geberit type Sigma 8cm").
⚠️ Si une note vocale du dossier dit explicitement "il faut X heures" ou "matériel Y", tu DOIS produire les lignes correspondantes — ne pas les ignorer. Et tu DOIS recopier la phrase exacte dans "voice_evidence" pour cette ligne.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_quote",
              description: "Retourne un pré-devis structuré",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                        qty: { type: "number" },
                        unit: { type: "string" },
                        estimated_price: { type: "number" },
                        vat_rate: { type: "number" },
                        type: { type: "string", enum: ["main_oeuvre", "deplacement", "materiel", "fourniture", "standard"] },
                        rationale: { type: "string" },
                        voice_evidence: { type: "string", description: "Citation verbatim de la note vocale qui justifie cette ligne (chaîne vide si la ligne ne provient pas d'une note vocale)" },
                      },
                      required: ["label", "qty", "unit", "estimated_price", "type"],
                    },
                  },
                  assumptions: { type: "array", items: { type: "string" } },
                  missing_questions: { type: "array", items: { type: "string" } },
                  detected_from_photos: {
                    type: "array",
                    description: "Une entrée par photo fournie (même ordre). Obligatoire si des photos sont jointes.",
                    items: {
                      type: "object",
                      properties: {
                        photo_name: { type: "string" },
                        material_label: { type: "string", description: "Type de matériel/équipement vu (ex: 'Mécanisme WC Geberit')" },
                        brand: { type: "string", description: "Marque visible ou chaîne vide" },
                        model_or_ref: { type: "string", description: "Modèle/référence visible ou chaîne vide" },
                        visible_state: { type: "string", description: "État visible (fuite, cassé, vétuste…)" },
                        dimensions: { type: "string", description: "Dimensions estimées si visibles ou chaîne vide" },
                      },
                      required: ["photo_name", "material_label", "visible_state"],
                    },
                  },
                  variants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                        lines: { type: "array", items: { type: "object" } },
                      },
                    },
                  },
                },
                required: ["title", "summary", "confidence", "lines", "assumptions", "missing_questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_quote" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "429 Trop de requêtes" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "402 Crédits IA épuisés" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: `AI ${aiResp.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      const finishReason = aiJson.choices?.[0]?.finish_reason ?? "unknown";
      console.error("[generate-ai-quote-draft] no tool_call in AI response", JSON.stringify({
        finish_reason: finishReason,
        content: aiJson.choices?.[0]?.message?.content ?? null,
        usage: aiJson.usage ?? null,
      }));
      let errMsg = "Réponse IA invalide";
      if (finishReason === "length") errMsg = "Réponse IA invalide (contexte trop long)";
      else if (finishReason === "content_filter") errMsg = "Réponse IA invalide (filtre de contenu)";
      return new Response(JSON.stringify({ error: errMsg, finish_reason: finishReason }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let payload: AiPayload;
    try {
      payload = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("[generate-ai-quote-draft] JSON.parse failed on tool arguments", parseErr, toolCall.function.arguments?.slice(0, 500));
      return new Response(JSON.stringify({ error: "Réponse IA invalide (JSON malformé)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Hybrid pricing : match catalogue
    function matchCatalog(line: AiLineRaw) {
      const target = normLabel(line.label);
      if (!target) return null;
      let best: any = null;
      let bestScore = 0;
      for (const c of catalog) {
        const cl = normLabel(c.label);
        let score = 0;
        if (cl === target) score = 1;
        else if (cl.includes(target) || target.includes(cl)) score = 0.7;
        else {
          const tokens = target.split(/\s+/).filter(Boolean);
          const matches = tokens.filter((t) => cl.includes(t)).length;
          if (tokens.length) score = matches / tokens.length * 0.6;
        }
        const syns = [...(c.synonyms ?? []), ...(c.tags ?? [])].map(normLabel);
        if (syns.some((s) => s && (s === target || target.includes(s)))) score += 0.2;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      return bestScore >= 0.55 ? best : null;
    }

    let catalog_match_count = 0;
    let ai_fallback_count = 0;
    const enrichLines = (rawLines: AiLineRaw[]) =>
      rawLines.map((l, idx) => {
        const cat = matchCatalog(l);
        const useCatalog = !!cat && cat.unit_price != null && Number(cat.unit_price) > 0;
        if (useCatalog) catalog_match_count++; else ai_fallback_count++;
        return {
          ref: `ai-${Date.now()}-${idx}`,
          label: useCatalog ? cat.label : l.label,
          description: l.description ?? "",
          qty: l.qty,
          unit: useCatalog ? (cat.unit ?? l.unit) : l.unit,
          unit_price: useCatalog ? Number(cat.unit_price) : l.estimated_price,
          vat_rate: l.vat_rate ?? (useCatalog ? Number(cat.vat_rate ?? 10) : 10),
          type: l.type,
          source: useCatalog ? "catalog" : "ai_fallback",
          catalog_item_id: useCatalog ? cat.id : null,
          rationale: l.rationale ?? null,
          voice_evidence: l.voice_evidence && l.voice_evidence.trim() ? l.voice_evidence.trim() : null,
        };
      });

    const lines = enrichLines(payload.lines ?? []);
    const variants = (payload.variants ?? []).map((v) => ({
      label: v.label,
      description: v.description,
      lines: enrichLines((v.lines as AiLineRaw[]) ?? []),
    }));

    const analysis_sources = {
      audio_count: validAudios.length,
      image_count: validImages.length,
      written_note_count: noteMedias.length,
       historic_note_count: notes.filter((n) => n.action === "note_added" || n.action === "note").length,
      past_quote_count: pastQuotes.length,
      has_summary_cache: !!effectiveSummary,
      voice_transcript_used: !!voice_transcript,
      dossier_voice_transcripts_count: cachedTranscripts.length,
    };

    console.log("[generate-ai-quote-draft] sources:", JSON.stringify(analysis_sources));
    const detectedFromPhotos = Array.isArray((payload as any).detected_from_photos)
      ? (payload as any).detected_from_photos
      : [];
    console.log(`[generate-ai-quote-draft] detected_from_photos count=${detectedFromPhotos.length}`);

    // 7) Log
    const { data: logRow, error: logErr } = await admin
      .from("ai_quote_suggestions_log")
      .insert({
        user_id: user.id,
        dossier_id,
        quote_id,
        status: "proposed",
        confidence: payload.confidence,
        catalog_match_count,
        ai_fallback_count,
        suggestion_payload: {
          title: payload.title,
          summary: payload.summary,
          lines,
          variants,
          assumptions: payload.assumptions ?? [],
          missing_questions: payload.missing_questions ?? [],
          analysis_sources,
          detected_from_photos: detectedFromPhotos,
        },
      })
      .select("id")
      .single();
    if (logErr) console.error("log insert failed", logErr);

    return new Response(
      JSON.stringify({
        log_id: logRow?.id ?? "",
        title: payload.title,
        summary: payload.summary,
        confidence: payload.confidence,
        lines,
        variants,
        assumptions: payload.assumptions ?? [],
        missing_questions: payload.missing_questions ?? [],
        catalog_match_count,
        ai_fallback_count,
        analysis_sources,
        detected_from_photos: detectedFromPhotos,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-ai-quote-draft error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
