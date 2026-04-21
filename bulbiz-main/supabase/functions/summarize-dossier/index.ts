import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

interface MediaRecord {
  file_url: string;
  file_type: string;
  file_name: string;
  created_at: string;
  media_category: string;
}

function toPublicMediaUrl(fileUrl: string, supabaseUrl: string): string {
  return fileUrl.startsWith("http")
    ? fileUrl
    : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${fileUrl}`;
}

async function downloadMediaAsBase64(
  media: MediaRecord,
  supabaseUrl: string,
  maxSizeMB: number
): Promise<{ base64: string; mimeType: string; name: string; date: string } | null> {
  try {
    const url = toPublicMediaUrl(media.file_url, supabaseUrl);

    const resp = await fetch(url);
    if (!resp.ok) return null;

    const blob = await resp.arrayBuffer();
    if (blob.byteLength > maxSizeMB * 1024 * 1024) return null;

    const base64 = base64Encode(new Uint8Array(blob));
    return { base64, mimeType: media.file_type, name: media.file_name, date: media.created_at };
  } catch (e) {
    console.error(`Error downloading ${media.file_name}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dossier_id, force } = await req.json();
    if (!dossier_id) throw new Error("dossier_id requis");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Verify the caller is authenticated
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch all data in parallel (including text notes and quote_lines)
    const [dossierRes, histRes, quotesRes, invoicesRes, slotsRes, audioMediasRes, imageMediasRes, noteMediasRes, quoteLinesRes] = await Promise.all([
      supabase.from("dossiers").select("*").eq("id", dossier_id).maybeSingle(),
      supabase.from("historique").select("action, details, created_at").eq("dossier_id", dossier_id).order("created_at", { ascending: false }).limit(15),
      supabase.from("quotes").select("id, quote_number, status, total_ht, total_ttc, sent_at, signed_at, pdf_url, is_imported, items, notes").eq("dossier_id", dossier_id),
      supabase.from("invoices").select("id, invoice_number, status, total_ht, total_tva, total_ttc, sent_at, paid_at, pdf_url, notes, client_first_name, client_last_name, client_email, client_phone, client_address").eq("dossier_id", dossier_id),
      supabase.from("appointment_slots").select("slot_date, time_start, time_end, selected_at").eq("dossier_id", dossier_id),
      supabase.from("medias").select("file_url, file_type, file_name, created_at, media_category")
        .eq("dossier_id", dossier_id).like("file_type", "audio/%").order("created_at", { ascending: false }).limit(6),
      supabase.from("medias").select("file_url, file_type, file_name, created_at, media_category")
        .eq("dossier_id", dossier_id).like("file_type", "image/%").order("created_at", { ascending: false }).limit(8),
      supabase.from("medias").select("file_url, file_type, file_name, created_at, media_category")
        .eq("dossier_id", dossier_id).eq("media_category", "note").order("created_at", { ascending: false }).limit(20),
      // Fetch quote_lines for structured data
      supabase.from("quote_lines").select("label, description, qty, unit, unit_price, tva_rate, line_type, quote_id, sort_order")
        .in("quote_id", []) // placeholder, will be re-fetched below if needed
    ]);

    if (dossierRes.error) throw dossierRes.error;
    if (!dossierRes.data) {
      return new Response(JSON.stringify({ error: "Dossier introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const d = dossierRes.data;

    const audioMedias = audioMediasRes.data || [];
    const imageMedias = imageMediasRes.data || [];
    const noteMedias = noteMediasRes.data || [];
    const quotes = quotesRes.data || [];
    const invoices = invoicesRes.data || [];
    const hist = histRes.data || [];

    // === CACHE LOGIC ===
    // Build fingerprint from data that affects the summary
    // IMPORTANT: include MAX(created_at) of every media kind so adding a new
    // voice note / photo / written note invalidates the cache automatically.
    const maxAudioAt = audioMedias[0]?.created_at ?? "";
    const maxImageAt = imageMedias[0]?.created_at ?? "";
    const maxNoteAt = noteMedias[0]?.created_at ?? "";
    const maxHistAt = hist[0]?.created_at ?? "";
    const fingerprintData = JSON.stringify({
      updated_at: d.updated_at,
      status: d.status,
      appointment_status: d.appointment_status,
      audio: { count: audioMedias.length, last: maxAudioAt },
      image: { count: imageMedias.length, last: maxImageAt },
      note: { count: noteMedias.length, last: maxNoteAt },
      hist: { count: hist.length, last: maxHistAt },
      quotes: quotes.map(q => ({ id: q.id, status: q.status, total_ttc: q.total_ttc })),
      invoices: invoices.map(i => ({ id: i.id, status: i.status, total_ttc: i.total_ttc })),
    });
    const fingerprintBytes = await crypto.subtle.digest("MD5", new TextEncoder().encode(fingerprintData));
    const fingerprint = new TextDecoder().decode(hexEncode(new Uint8Array(fingerprintBytes)));

    // Always read the previous cache entry (even on a miss / force refresh) so we can
    // inject the previously identified material_list into the new prompt. This gives
    // the AI memory: items found from older voice notes / photos persist instead of
    // being randomly dropped from one run to the next.
    const { data: cached } = await supabase
      .from("ai_summary_cache")
      .select("summary_json, data_fingerprint")
      .eq("dossier_id", dossier_id)
      .maybeSingle();

    if (!force && cached && cached.data_fingerprint === fingerprint) {
      console.log("Cache HIT for dossier", dossier_id);
      return new Response(JSON.stringify(cached.summary_json), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(force ? `Force refresh for dossier ${dossier_id}` : `Cache MISS for dossier ${dossier_id}`);

    // Extract previous material_list (if any) for AI memory.
    const previousMaterialList: Array<{ label: string; qty?: number; unit?: string; ref?: string }> =
      Array.isArray((cached?.summary_json as any)?.material_list)
        ? (cached!.summary_json as any).material_list
        : [];

    // Download images and audio. Limits aligned with generate-ai-quote-draft (4 Mo)
    // so étiquette photos (~3 Mo) and notes vocales longues ne sont plus silencieusement ignorées.
    const [audioResults, imageResults] = await Promise.all([
      Promise.all(audioMedias.map(m => downloadMediaAsBase64(m, supabaseUrl, 4))),
      Promise.all(imageMedias.map(m => downloadMediaAsBase64(m, supabaseUrl, 4))),
    ]);

    // Track media that was rejected (mostly: too large) so we can warn the artisan.
    const imagesSkipped = imageMedias.length - imageResults.filter(Boolean).length;
    const audiosSkipped = audioMedias.length - audioResults.filter(Boolean).length;
    if (imagesSkipped > 0) {
      console.warn(`[summarize-dossier] ${imagesSkipped} image(s) skipped (download failed or > 4 Mo)`);
    }
    if (audiosSkipped > 0) {
      console.warn(`[summarize-dossier] ${audiosSkipped} audio(s) skipped (download failed or > 4 Mo)`);
    }

    // Build multimodal content parts
    const mediaParts: Array<{ type: string; image_url?: { url: string }; text?: string }> = [];

    // Images
    const validImages = imageResults.filter(Boolean);
    if (validImages.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n📷 PHOTOS DU CHANTIER (${validImages.length}) :` });
      for (const img of validImages) {
        if (!img) continue;
        const mime = toImageMime(img.mimeType);
        mediaParts.push({ type: "text", text: `[Photo "${img.name}" du ${img.date.slice(0, 16)}] :` });
        mediaParts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${img.base64}` } });
      }
    }

    // Audio
    const validAudios = audioResults.filter(Boolean);
    // === Step A: explicit verbatim transcription of each artisan voice note ===
    // We call Gemini once per audio with a transcription-only prompt so the verbatim
    // text is GUARANTEED to land in the main prompt, instead of relying on the model
    // to "transcribe-then-use" in a single pass.
    const LOVABLE_API_KEY_FOR_TX = Deno.env.get("LOVABLE_API_KEY");
    const audioTranscripts: { name: string; date: string; text: string }[] = [];
    if (validAudios.length > 0 && LOVABLE_API_KEY_FOR_TX) {
      // Parallelize transcriptions: 5 audio notes go from ~50s sequential to ~10s parallel.
      // Use gemini-2.5-flash (3-4x faster than pro, equivalent quality on verbatim French ASR).
      const txResults = await Promise.all(
        validAudios.map(async (audio) => {
          if (!audio) return null;
          const mime = toAudioMime(audio.mimeType);
          const fmt = mime.includes("mp4") || mime.includes("m4a") ? "mp4"
            : mime.includes("wav") ? "wav"
            : mime.includes("mp3") || mime.includes("mpeg") ? "mp3"
            : mime.includes("ogg") ? "ogg"
            : "webm";
          try {
            const txCtl = new AbortController();
            const txTimer = setTimeout(() => txCtl.abort(), 35_000);
            const txResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              signal: txCtl.signal,
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY_FOR_TX}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: "Tu es un transcripteur audio professionnel français. Transcris le contenu audio MOT À MOT en français, sans résumer, sans interpréter, sans ajouter ni retirer un mot. Réponds UNIQUEMENT avec la transcription, rien d'autre.",
                  },
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "Transcris cette note vocale d'artisan, verbatim." },
                      { type: "input_audio", input_audio: { data: audio.base64, format: fmt } } as any,
                    ],
                  },
                ],
                temperature: 0,
              }),
            }).finally(() => clearTimeout(txTimer));
            if (txResp.ok) {
              const txJson = await txResp.json();
              const text = (txJson.choices?.[0]?.message?.content || "").trim();
              if (text) {
                console.log(`[summarize-dossier] transcribed "${audio.name}" — ${text.length} chars`);
                return { name: audio.name, date: audio.date, text };
              }
            } else {
              console.warn(`[summarize-dossier] transcription failed for ${audio.name}: HTTP ${txResp.status}`);
            }
          } catch (e) {
            console.error(`[summarize-dossier] transcription error for ${audio.name}:`, e);
          }
          return null;
        })
      );
      for (const r of txResults) if (r) audioTranscripts.push(r);
    }

    if (validAudios.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n🎙️ NOTES VOCALES (${validAudios.length}) :` });
      for (const audio of validAudios) {
        if (!audio) continue;
        const mime = toAudioMime(audio.mimeType);
        const fmt = mime.includes("mp4") || mime.includes("m4a") ? "mp4"
          : mime.includes("wav") ? "wav"
          : mime.includes("mp3") || mime.includes("mpeg") ? "mp3"
          : mime.includes("ogg") ? "ogg"
          : "webm";
        mediaParts.push({ type: "text", text: `[Note vocale "${audio.name}" du ${audio.date.slice(0, 16)}] :` });
        mediaParts.push({ type: "input_audio", input_audio: { data: audio.base64, format: fmt } } as any);
      }
    }

    // Process quotes: structured lines + items JSONB + PDF downloads
    let quotesTextContext = "";
    let quotePdfCount = 0;

    // Fetch quote_lines if we have quotes
    if (quotes.length > 0) {
      const quoteIds = quotes.map(q => q.id);
      const { data: quoteLines } = await supabase
        .from("quote_lines").select("label, description, qty, unit, unit_price, tva_rate, line_type, quote_id, sort_order")
        .in("quote_id", quoteIds).order("sort_order");

      if (quoteLines && quoteLines.length > 0) {
        const linesByQuote = new Map<string, typeof quoteLines>();
        for (const line of quoteLines) {
          const arr = linesByQuote.get(line.quote_id) || [];
          arr.push(line);
          linesByQuote.set(line.quote_id, arr);
        }

        for (const q of quotes) {
          const lines = linesByQuote.get(q.id);
          if (lines && lines.length > 0) {
            quotesTextContext += `\n📋 DÉTAIL DEVIS ${q.quote_number} (${q.status}) :\n`;
            for (const l of lines) {
              const desc = l.description ? ` — ${l.description}` : "";
              quotesTextContext += `  • ${l.label}${desc} | ${l.qty} ${l.unit} × ${l.unit_price}€ HT (TVA ${l.tva_rate}%) [${l.line_type}]\n`;
            }
            if (q.notes) quotesTextContext += `  📝 Notes devis: ${q.notes}\n`;
          }
        }
      }
    }

    // Fallback: items JSONB for quotes without quote_lines
    for (const q of quotes) {
      if (quotesTextContext.includes(q.quote_number)) continue;
      const items = q.items as any[] | null;
      if (items && Array.isArray(items) && items.length > 0) {
        quotesTextContext += `\n📋 DÉTAIL DEVIS ${q.quote_number} (${q.status}) :\n`;
        for (const item of items) {
          const label = item.label || item.designation || "?";
          const qty = item.qty ?? item.quantity ?? 1;
          const unit = item.unit || "u";
          const price = item.unit_price ?? item.unitPrice ?? 0;
          quotesTextContext += `  • ${label} | ${qty} ${unit} × ${price}€ HT\n`;
        }
        if (q.notes) quotesTextContext += `  📝 Notes devis: ${q.notes}\n`;
      }
    }

    // Download imported quote PDFs (max 2, 5MB each)
    const importedWithPdf = quotes.filter(q => q.pdf_url).slice(0, 2);
    const pdfResults = await Promise.all(
      importedWithPdf.map(async (q) => {
        try {
          const url = q.pdf_url!.startsWith("http")
            ? q.pdf_url!
            : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${q.pdf_url}`;
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const blob = await resp.arrayBuffer();
          if (blob.byteLength > 5 * 1024 * 1024) return null;
          const b64 = base64Encode(new Uint8Array(blob));
          return { base64: b64, quoteNumber: q.quote_number };
        } catch (e) {
          console.error(`Error downloading PDF for ${q.quote_number}:`, e);
          return null;
        }
      })
    );

    const validPdfs = pdfResults.filter(Boolean);
    quotePdfCount = validPdfs.length;

    if (validPdfs.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n📄 DEVIS PDF IMPORTÉS (${validPdfs.length}) — Extrais le matériel, références, marques et quantités :` });
      for (const pdf of validPdfs) {
        if (!pdf) continue;
        mediaParts.push({ type: "text", text: `[Devis "${pdf.quoteNumber}"] :` });
        mediaParts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf.base64}` } });
      }
    }

    // Process invoices
    // invoices already declared above (line 118)
    let invoicesTextContext = "";
    let invoicePdfCount = 0;

    if (invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);
      const { data: lines } = await supabase
        .from("invoice_lines").select("label, description, qty, unit, unit_price, tva_rate, invoice_id")
        .in("invoice_id", invoiceIds).order("sort_order");

      if (lines && lines.length > 0) {
        const linesByInvoice = new Map<string, typeof lines>();
        for (const line of lines) {
          const arr = linesByInvoice.get(line.invoice_id) || [];
          arr.push(line);
          linesByInvoice.set(line.invoice_id, arr);
        }

        for (const inv of invoices) {
          const invLines = linesByInvoice.get(inv.id);
          if (invLines && invLines.length > 0) {
            invoicesTextContext += `\n🧾 DÉTAIL FACTURE ${inv.invoice_number} (${inv.status}) :\n`;
            for (const l of invLines) {
              const desc = l.description ? ` — ${l.description}` : "";
              invoicesTextContext += `  • ${l.label}${desc} | ${l.qty} ${l.unit} × ${l.unit_price}€ HT (TVA ${l.tva_rate}%)\n`;
            }
          }
        }
      }
    }

    for (const inv of invoices) {
      if (inv.notes) invoicesTextContext += `  📝 Notes ${inv.invoice_number}: ${inv.notes}\n`;
    }

    // Download invoice PDFs
    const invoicesWithPdf = invoices.filter(i => i.pdf_url).slice(0, 2);
    const invoicePdfResults = await Promise.all(
      invoicesWithPdf.map(async (inv) => {
        try {
          const url = inv.pdf_url!.startsWith("http")
            ? inv.pdf_url!
            : `${supabaseUrl}/storage/v1/object/public/dossier-medias/${inv.pdf_url}`;
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const blob = await resp.arrayBuffer();
          if (blob.byteLength > 5 * 1024 * 1024) return null;
          const b64 = base64Encode(new Uint8Array(blob));
          return { base64: b64, invoiceNumber: inv.invoice_number };
        } catch (e) {
          console.error(`Error downloading PDF for ${inv.invoice_number}:`, e);
          return null;
        }
      })
    );

    const validInvoicePdfs = invoicePdfResults.filter(Boolean);
    invoicePdfCount = validInvoicePdfs.length;

    if (validInvoicePdfs.length > 0) {
      mediaParts.push({ type: "text", text: `\n\n🧾 FACTURES PDF (${validInvoicePdfs.length}) :` });
      for (const pdf of validInvoicePdfs) {
        if (!pdf) continue;
        mediaParts.push({ type: "text", text: `[Facture "${pdf.invoiceNumber}"] :` });
        mediaParts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf.base64}` } });
      }
    }

    const hasInvoiceContent = invoicesTextContext.length > 0 || invoicePdfCount > 0;
    const hasMedia = mediaParts.length > 0;
    const hasAudio = validAudios.length > 0;
    const hasImages = validImages.length > 0;
    const hasNotes = noteMedias.length > 0;
    const hasQuoteContent = quotesTextContext.length > 0 || quotePdfCount > 0;

    // === SHORT-CIRCUIT for empty dossiers ===
    // If we have nothing rich to analyze (no audio, image, note, quote, facture
    // and only a short or absent description), skip the AI call entirely and
    // return a basic structured summary in <500ms. Saves credits + latency.
    const richDescription = (d.description || "").trim().length > 60;
    const hasAnyAiInput = hasAudio || hasImages || hasNotes || hasQuoteContent || hasInvoiceContent || richDescription;
    if (!hasAnyAiInput && previousMaterialList.length === 0) {
      const catLabel = d.category || "intervention";
      const urgLabel = d.urgency || "semaine";
      const basic = {
        headline: `Demande ${catLabel} — urgence ${urgLabel}`,
        bullets: [
          d.address ? `Adresse : ${d.address}` : "Adresse non renseignée",
          d.client_phone ? `Téléphone : ${d.client_phone}` : "Téléphone non renseigné",
          d.description ? `Description : ${d.description.slice(0, 120)}` : "Aucune description fournie",
        ].filter(Boolean),
        next_action: d.appointment_status === "none"
          ? "Proposer un créneau au client"
          : "Préparer l'intervention",
        material_list: [],
        auto_filled: [],
        media_analyzed: { images: 0, videos: 0, audio: 0, notes: 0, quotes: 0, invoices: 0 },
        media_skipped: { images_too_large: imagesSkipped, audios_too_large: audiosSkipped },
        voice_transcripts: [],
      };
      // Cache it so future opens are instant too.
      await supabase.from("ai_summary_cache").upsert({
        dossier_id,
        summary_json: basic,
        data_fingerprint: fingerprint,
        generated_at: new Date().toISOString(),
      }, { onConflict: "dossier_id" });
      return new Response(JSON.stringify(basic), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build empty fields list for auto-fill
    // Only empty fields are candidates — fields already filled (by client or artisan) are NEVER overwritten
    const emptyFields: string[] = [];
    if (!d.address) emptyFields.push("address");
    if (!d.address_line) emptyFields.push("address_line");
    if (!d.postal_code) emptyFields.push("postal_code");
    if (!d.city) emptyFields.push("city");
    if (!d.client_phone || d.client_phone === "00000") emptyFields.push("client_phone");
    if (!d.client_email) emptyFields.push("client_email");
    if (!d.client_first_name) emptyFields.push("client_first_name");
    if (!d.client_last_name) emptyFields.push("client_last_name");
    if (!d.description) emptyFields.push("description");
    if (!d.housing_type) emptyFields.push("housing_type");
    if (!d.floor_number && d.floor_number !== 0) emptyFields.push("floor_number");
    if (!d.access_code) emptyFields.push("access_code");
    if (!d.availability) emptyFields.push("availability");

    const hasEmptyFields = emptyFields.length > 0 && (hasAudio || hasImages || hasNotes || hasQuoteContent || hasInvoiceContent);

    // Build verbatim voice transcripts context (artisan + client voice notes)
    const voiceTranscriptsText = audioTranscripts.length > 0
      ? `\n🎙️ NOTES VOCALES TRANSCRITES VERBATIM (${audioTranscripts.length}) — source de vérité :\n` +
        audioTranscripts
          .map((t) => `  ▸ [${t.date.slice(0, 16)} — ${t.name}]\n    « ${t.text.replace(/\s+/g, " ").trim()} »`)
          .join("\n")
      : "";

    // Build text notes context
    let notesTextContext = "";
    const historicalTextNotes = hist.filter((h) => h.action === "note" || h.action === "note_added");
    if (hasNotes || historicalTextNotes.length > 0) {
      notesTextContext = `\n✏️ NOTES ÉCRITES DE L'ARTISAN (${noteMedias.length + historicalTextNotes.length}) :\n`;
      for (const note of historicalTextNotes) {
        notesTextContext += `  • [${note.created_at.slice(0, 16)}] ${note.details || "Note artisan"}\n`;
      }
      for (const note of noteMedias) {
        notesTextContext += `  • [${note.created_at.slice(0, 16)}] ${note.file_name}\n`;
      }
    }

    // Build full context
    const context = `
DOSSIER #${d.id.slice(0, 8)}
═══════════════════════════════════════

👤 CLIENT
Nom: ${[d.client_first_name, d.client_last_name].filter(Boolean).join(" ") || "Non renseigné"}
Email: ${d.client_email || "Non renseigné"} | Tél: ${d.client_phone || "Non renseigné"}
Disponibilités: ${d.availability || "Non renseignées"}

📍 CHANTIER
Adresse: ${d.address || "Non renseignée"}
Rue: ${d.address_line || "?"} | CP: ${d.postal_code || "?"} | Ville: ${d.city || "?"}
Logement: ${d.housing_type || "Non renseigné"} | Étage: ${d.floor_number ?? "?"} | Ascenseur: ${d.has_elevator === true ? "Oui" : d.has_elevator === false ? "Non" : "?"}
Code accès: ${d.access_code || "Non renseigné"}
Occupant: ${d.occupant_type || "?"}

🔧 PROBLÈME
Catégorie: ${d.category} | Urgence: ${d.urgency}
Types de problème: ${d.problem_types?.join(", ") || "Non précisé"}
Corps de métier: ${d.trade_types?.join(", ") || "Non précisé"}
Description: ${d.description || "Aucune description"}

📋 STATUT ADMINISTRATIF
Statut dossier: ${d.status} | Source: ${d.source}
Relances: ${d.relance_count} envoyée(s)${d.last_relance_at ? ` (dernière: ${d.last_relance_at.slice(0, 10)})` : ""}

📅 RENDEZ-VOUS
Statut RDV: ${d.appointment_status}${d.appointment_date ? `\nDate: ${d.appointment_date} de ${(d.appointment_time_start || "").slice(0, 5)} à ${(d.appointment_time_end || "").slice(0, 5)}` : ""}
${d.appointment_notes ? `Notes RDV: ${d.appointment_notes}` : ""}

💰 DEVIS (${quotes.length}):
${quotes.map(q => `  • ${q.quote_number}: ${q.status} — ${q.total_ttc ?? 0}€ TTC${q.sent_at ? " ✉️ envoyé" : ""}${q.signed_at ? " ✅ signé" : ""}`).join("\n") || "  Aucun devis"}
${quotesTextContext}

🧾 FACTURES (${invoices.length}):
${invoices.map(f => {
  let info = `  • ${f.invoice_number}: ${f.status} — ${f.total_ttc ?? 0}€ TTC${f.paid_at ? " ✅ payée" : f.sent_at ? " ✉️ envoyée" : ""}`;
  const clientInfo = [f.client_first_name, f.client_last_name].filter(Boolean).join(" ");
  if (clientInfo) info += `\n    Client facture: ${clientInfo}`;
  if (f.client_email) info += ` | Email: ${f.client_email}`;
  if (f.client_phone) info += ` | Tél: ${f.client_phone}`;
  if (f.client_address) info += `\n    Adresse facture: ${f.client_address}`;
  return info;
}).join("\n") || "  Aucune facture"}
${invoicesTextContext}

📅 CRÉNEAUX PROPOSÉS (${slotsRes.data?.length || 0}):
${(slotsRes.data || []).map(s => `  • ${s.slot_date} ${s.time_start.slice(0, 5)}-${s.time_end.slice(0, 5)}${s.selected_at ? " ✅ choisi par le client" : ""}`).join("\n") || "  Aucun"}
${notesTextContext}

${voiceTranscriptsText}

📜 HISTORIQUE RÉCENT:
${(histRes.data || []).map(h => `  • ${h.action}: ${h.details || ""} (${h.created_at.slice(0, 16)})`).join("\n") || "  Aucun"}

${hasEmptyFields ? `\n⚠️ CHAMPS MANQUANTS À EXTRAIRE DES MÉDIAS: ${emptyFields.join(", ")}` : ""}

${previousMaterialList.length > 0 ? `\n📦 LISTE PRÉCÉDEMMENT IDENTIFIÉE (${previousMaterialList.length} item(s)) — À CONSERVER ET À ENRICHIR :
${previousMaterialList.map((m, i) => `  ${i + 1}. ${m.qty ?? 1} ${m.unit || "u"} — ${m.label}${m.ref && m.ref !== "n/a" ? ` (ref ${m.ref})` : ""}`).join("\n")}

➡️ Reprends TOUS ces items dans ta nouvelle material_list. Ajoute les nouveaux matériels que tu détectes dans les nouvelles photos / notes / devis. Ne supprime un item QUE si tu as une preuve formelle (devis modifié, photo récente prouvant l'absence). Tu peux fusionner deux items quasi-identiques.` : ""}
`.trim();

    const userContent: any = hasMedia
      ? [{ type: "text", text: context }, ...mediaParts]
      : context;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build extraction schema — use tool calling for structured extraction to reduce hallucination
    const extractionSchema = hasEmptyFields ? `,
   "extracted_fields": {
     // Uniquement les champs trouvés dans les médias, devis ou factures parmi: ${emptyFields.join(", ")}
     // RÈGLE ABSOLUE : ne remplis un champ QUE si tu peux CITER la source exacte (ex: "facture FAC-2026-001", "note vocale du 05/03", "photo IMG_001")
     // Si tu n'as PAS de source précise → n'inclus PAS le champ
     // Préfère ne PAS remplir plutôt que risquer une erreur
   }` : "";

    const systemPrompt = `Tu es l'assistant IA de terrain d'un artisan (plombier/chauffagiste/multi-services). Ton rôle est de générer un résumé OPÉRATIONNEL qui aide l'artisan à :
1. Comprendre le problème en 3 secondes
2. Savoir exactement quel matériel emporter
3. Connaître les conditions d'accès au chantier
4. Avoir le statut administratif clair

Tu analyses TOUS les médias fournis : photos (détecte visuellement le problème, marque et modèle d'équipement), notes vocales (transcris et intègre les infos clés), devis/factures (extrais la liste de matériel DÉTAILLÉE avec marques, références, quantités).

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) :
{
  "headline": "phrase courte résumant la situation et le problème principal (max 15 mots)",
  "bullets": [
    "Problème : description technique précise du problème identifié",
    "Accès : étage, code, parking, conditions d'accès chantier",
    "Admin : statut devis/facture/RDV en 1 ligne",
    "Client : disponibilités et moyen de contact",
    "... autres points importants identifiés dans les médias"
  ],
  "next_action": "action concrète prioritaire pour l'artisan (max 20 mots)",
  "material_list": [
    { "label": "Nom exact du matériel/fourniture", "qty": 1, "unit": "u", "ref": "référence ou marque si connue" }
  ]${extractionSchema}
}

⚠️ RÈGLE ANTI-HALLUCINATION (PRIORITÉ MAXIMALE) :
- Tu ne dois JAMAIS inventer, deviner, supposer ou fabriquer une information qui n'est PAS EXPLICITEMENT présente dans les données fournies.
- Si une information n'est pas dans les données → écris "Non renseigné" ou omet le champ. JAMAIS de valeur inventée.
- Pour le résumé (headline, bullets) : ne décris QUE ce qui est dans les données. Si tu n'as pas assez d'info, dis-le clairement.
- Pour material_list : n'inclus QUE le matériel EXPLICITEMENT mentionné dans un devis, une facture, une note vocale, une note écrite ou visible sur une photo. Si aucun matériel n'est mentionné → material_list = []

RÈGLES STRICTES :
- headline : max 15 mots, situation actuelle + problème
- bullets : 3 à 7 points, PAS d'emoji, max 25 mots chacun. Priorise : problème technique → matériel → accès → admin → client
- Si tu manques d'information pour un bullet, écris "Information non disponible" plutôt qu'inventer
- next_action : action CONCRÈTE (ex: "Commander le ballon Thermor 200L avant intervention", "Appeler le client pour confirmer le créneau")
- material_list :
  * Devis et factures : chaque ligne de matériel/fourniture
  * Notes vocales : UNIQUEMENT le matériel CLAIREMENT dicté (ex: "il faudra un joint de 40")
  * Notes écrites : tout matériel listé par l'artisan
  * Photos : matériel identifiable visuellement UNIQUEMENT si la marque/modèle est LISIBLE sur la photo
  * label : nom exact (garde les marques, modèles, dimensions)
  * qty : quantité (1 par défaut si non précisée)
  * unit : unité de mesure (u, m, m², m³, kg, L, lot, forfait). Par défaut "u" si non précisé dans le devis/facture/note
  * ref : référence fabricant, marque ou "n/a"
   * N'inclus PAS la main d'œuvre, déplacement, ou frais administratifs
   * Si aucun matériel identifié nulle part : material_list = []
   * 🧠 MÉMOIRE — RÈGLE DE CONSERVATION : si la section "📦 LISTE PRÉCÉDEMMENT IDENTIFIÉE" est fournie dans le contexte, tu DOIS reprendre TOUS ses items dans ta nouvelle material_list, sauf si tu as une preuve EXPLICITE qu'un item a été retiré (devis modifié qui ne le contient plus, photo récente montrant clairement que le matériel ancien n'est plus pertinent). Tu peux fusionner deux items quasi-identiques (ex: "Joint 40mm" + "Joint torique 40 mm" → un seul). Tu AJOUTES les nouveaux items détectés dans les nouvelles photos / notes vocales / notes écrites. Ne supprime JAMAIS un item juste parce que tu n'as pas de nouvelle preuve : l'absence de preuve n'est pas une preuve d'absence.
- Les photos : décris ce que tu VOIS réellement (type de tuyau, marque visible, état, dégâts). Ne déduis PAS une marque ou un modèle si ce n'est pas lisible.
- Les notes vocales : transcris les infos UTILES pour le chantier. N'ajoute PAS d'information que tu n'entends pas clairement.
- Les notes écrites : intègre dans le résumé ET extrais le matériel mentionné
- Les devis et factures : extrais le matériel ET les informations client (nom, prénom, email, téléphone, adresse) UNIQUEMENT depuis les données structurées fournies
- Ignore les erreurs techniques dans l'historique
${hasEmptyFields ? `- extracted_fields — RÈGLES CRITIQUES :
  * N'inclus un champ QUE si l'information est EXPLICITEMENT et LITTÉRALEMENT présente dans une source
  * client_phone : UNIQUEMENT un numéro dicté MOT À MOT dans une note vocale, ÉCRIT dans une note, ou PRÉSENT dans les données structurées d'un devis/facture. JAMAIS deviner. En cas de doute → NE PAS inclure.
  * client_email : UNIQUEMENT si LITTÉRALEMENT présent dans une source (pas de déduction)
  * address, postal_code, city : UNIQUEMENT si présents dans un devis/facture structuré ou dictés clairement
  * description : UNIQUEMENT un résumé fidèle de ce que l'artisan a dit/écrit, pas d'interprétation
  * housing_type : UNIQUEMENT si explicitement mentionné ("appartement", "maison", "local commercial")
  * floor_number : UNIQUEMENT si un numéro d'étage est explicitement dit/écrit
  * access_code : UNIQUEMENT si un code est explicitement donné
  * PRÉFÈRE NE PAS REMPLIR plutôt que risquer une information fausse` : ""}`;


    // 50s timeout — protects against the 150s edge runtime hard cap and gives the
    // client a chance to surface a clean error instead of moulinant à l'infini.
    const aiCtl = new AbortController();
    const aiTimer = setTimeout(() => aiCtl.abort(), 50_000);
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: aiCtl.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Flash is 3-4x faster than Pro and largement suffisant pour cette synthèse.
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
      }),
    }).finally(() => clearTimeout(aiTimer));

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { headline: rawContent.slice(0, 80) || "Résumé en cours de traitement", bullets: [], next_action: "", material_list: [] };
    }

    // Process extracted fields if present
    let updatedFields: string[] = [];
    if (parsed.extracted_fields && typeof parsed.extracted_fields === "object") {
      const args = parsed.extracted_fields;
      const updatePayload: Record<string, any> = {};
      const fieldLabels: Record<string, string> = {
        address: "Adresse", address_line: "Rue", postal_code: "Code postal", city: "Ville",
        client_phone: "Téléphone", client_email: "Email", client_first_name: "Prénom",
        client_last_name: "Nom", description: "Description", housing_type: "Type logement",
        floor_number: "Étage", access_code: "Code accès", availability: "Disponibilités",
      };

      // Cross-validate extracted fields against actual source data
      // Build a set of "known" values from structured data (invoices, quotes) for cross-checking
      const knownPhones = new Set<string>();
      const knownEmails = new Set<string>();
      const knownNames = new Set<string>();
      const knownAddresses = new Set<string>();
      for (const inv of invoices) {
        if (inv.client_phone) knownPhones.add(inv.client_phone.replace(/[\s.\-()]/g, ""));
        if (inv.client_email) knownEmails.add(inv.client_email.toLowerCase());
        if (inv.client_first_name) knownNames.add(inv.client_first_name.toLowerCase());
        if (inv.client_last_name) knownNames.add(inv.client_last_name.toLowerCase());
        if (inv.client_address) knownAddresses.add(inv.client_address.toLowerCase());
      }

      for (const [key, value] of Object.entries(args)) {
        if (value === null || value === undefined || value === "" || !emptyFields.includes(key)) continue;
        const strValue = String(value).trim();
        if (!strValue) continue;

        // Validate phone numbers
        if (key === "client_phone") {
          const phone = strValue.replace(/[\s.\-()]/g, "");
          const isValidFormat = /^(\+?\d{10,15}|0\d{9})$/.test(phone);
          if (!isValidFormat) {
            console.log("Skipping invalid phone format:", value);
            continue;
          }
          // Extra check: if we have structured invoice data, phone should match one of them
          // If no invoices have phones, we accept it but log a warning
          if (knownPhones.size > 0 && !knownPhones.has(phone)) {
            console.log("Skipping phone not found in any structured source:", value);
            continue;
          }
        }

        // Validate email
        if (key === "client_email") {
          const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue);
          if (!isValidEmail) {
            console.log("Skipping invalid email:", value);
            continue;
          }
          if (knownEmails.size > 0 && !knownEmails.has(strValue.toLowerCase())) {
            console.log("Skipping email not found in any structured source:", value);
            continue;
          }
        }

        // Validate postal code (French format)
        if (key === "postal_code") {
          if (!/^\d{5}$/.test(strValue)) {
            console.log("Skipping invalid postal code:", value);
            continue;
          }
        }

        // Validate floor number
        if (key === "floor_number") {
          const num = Number(value);
          if (!Number.isInteger(num) || num < -5 || num > 50) {
            console.log("Skipping suspicious floor number:", value);
            continue;
          }
        }

        // Validate housing type
        if (key === "housing_type") {
          const validTypes = ["appartement", "maison", "local_commercial", "bureau", "commerce", "atelier", "cave", "parking", "immeuble"];
          if (!validTypes.some(t => strValue.toLowerCase().includes(t))) {
            console.log("Skipping suspicious housing type:", value);
            continue;
          }
        }

        // Limit string lengths to prevent garbage data
        if (typeof value === "string" && value.length > 500) {
          console.log(`Skipping suspiciously long value for ${key}: ${value.length} chars`);
          continue;
        }

        updatePayload[key] = value;
        updatedFields.push(fieldLabels[key] || key);
      }

      if (Object.keys(updatePayload).length > 0) {
        console.log("Auto-updating dossier fields:", Object.keys(updatePayload));
        const { error: updateError } = await supabase
          .from("dossiers").update(updatePayload).eq("id", dossier_id);

        if (updateError) {
          console.error("Error updating dossier:", updateError);
        } else {
          const sourceLabel = [hasImages && "photos", hasAudio && "notes vocales", hasNotes && "notes écrites", hasQuoteContent && "devis", hasInvoiceContent && "factures"].filter(Boolean).join(", ");
          await supabase.from("historique").insert({
            dossier_id, user_id: d.user_id, action: "ai_auto_fill",
            details: `IA : champs remplis automatiquement depuis ${sourceLabel} — ${updatedFields.join(", ")}`,
          });
        }
      }
      delete parsed.extracted_fields;
    }

    parsed.auto_filled = updatedFields;
    parsed.media_analyzed = {
      images: validImages.length,
      videos: 0,
      audio: validAudios.length,
      notes: noteMedias.length,
      quotes: quotePdfCount + (quotesTextContext.length > 0 ? quotes.filter(q => {
        const items = q.items as any[] | null;
        return items && Array.isArray(items) && items.length > 0;
      }).length : 0),
      invoices: invoicePdfCount + (invoicesTextContext.length > 0 ? 1 : 0),
    };
    // Expose verbatim voice transcripts so downstream consumers
    // (generate-ai-quote-draft) can inject them into the quote prompt.
    parsed.voice_transcripts = audioTranscripts;

    // Tell the UI when media was rejected (mostly because it exceeded the 4 Mo cap),
    // so we can show a helpful banner instead of failing silently.
    parsed.media_skipped = {
      images_too_large: imagesSkipped,
      audios_too_large: audiosSkipped,
    };

    // === SAVE TO CACHE ===
    await supabase.from("ai_summary_cache").upsert({
      dossier_id,
      summary_json: parsed,
      data_fingerprint: fingerprint,
      generated_at: new Date().toISOString(),
    }, { onConflict: "dossier_id" }).then(({ error }) => {
      if (error) console.error("Cache upsert error:", error);
      else console.log("Cache saved for dossier", dossier_id);
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : (typeof e === "string" ? e : JSON.stringify(e));
    console.error("summarize-dossier error:", message, e);
    return new Response(JSON.stringify({ error: message || "Erreur inconnue côté serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
