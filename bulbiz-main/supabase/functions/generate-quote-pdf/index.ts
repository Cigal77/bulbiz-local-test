import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  loadComplianceContext,
  buildLegalMentions,
  getMissingMandatoryFields,
  getDisplayName,
  type CustomerInfo,
} from "../_shared/compliance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuoteItem {
  label: string;
  description?: string;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  discount: number;
  discount_unit?: "PERCENT" | "EUR";
}

function calcLineTotal(item: QuoteItem): number {
  const base = item.qty * item.unit_price;
  const d = item.discount || 0;
  if (item.discount_unit === "EUR") return Math.max(0, base - d);
  return base - (base * d) / 100;
}

function sanitizeWinAnsi(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/[\u00A0\u202F\u2007\u2009\u200A\u200B\u2060]/g, " ")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/€/g, "\x80")
    .replace(/ƒ/g, "\x83")
    .replace(/Š/g, "\x8A").replace(/š/g, "\x9A")
    .replace(/Œ/g, "\x8C").replace(/œ/g, "\x9C")
    .replace(/Ž/g, "\x8E").replace(/ž/g, "\x9E")
    .replace(/Ÿ/g, "\x9F")
    .replace(/[^\x00-\xFF]/g, "?");
}

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function embedLogo(doc: any, logoUrl: string): Promise<any | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("png")) return await doc.embedPng(bytes);
    if (ct.includes("jpeg") || ct.includes("jpg")) return await doc.embedJpg(bytes);
    try { return await doc.embedPng(bytes); } catch { /* ignore */ }
    try { return await doc.embedJpg(bytes); } catch { /* ignore */ }
    return null;
  } catch {
    return null;
  }
}

async function buildPdf(
  rawProfile: Record<string, unknown>,
  dossier: Record<string, unknown>,
  quote: Record<string, unknown>,
  items: QuoteItem[],
  mentions: ReturnType<typeof buildLegalMentions>,
  artisanDisplayName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const primary = rgb(0.09, 0.24, 0.48);
  const accent = rgb(0.16, 0.50, 0.73);
  const darkText = rgb(0.12, 0.12, 0.14);
  const grayText = rgb(0.40, 0.42, 0.47);
  const lightBg = rgb(0.95, 0.96, 0.97);
  const lineColor = rgb(0.85, 0.87, 0.90);
  const white = rgb(1, 1, 1);

  const drawText = (text: string, x: number, yPos: number, size: number, f = font, color = darkText) => {
    page.drawText(sanitizeWinAnsi(text), { x, y: yPos, size, font: f, color });
  };

  const addNewPageIfNeeded = (needed: number) => {
    if (y - needed < margin + 60) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  let logoImage: any = null;
  if (rawProfile.logo_url) {
    logoImage = await embedLogo(doc, String(rawProfile.logo_url));
  }

  const headerStartY = y;
  let artisanX = margin;

  const drawArtisanInfo = (startX: number, startY: number) => {
    let infoY = startY;
    drawText(artisanDisplayName, startX, infoY, logoImage ? 14 : 16, fontBold, primary);
    if (mentions.ei_mention) {
      const w = fontBold.widthOfTextAtSize(artisanDisplayName, logoImage ? 14 : 16);
      drawText(" — " + mentions.ei_mention, startX + w, infoY, 8, fontOblique, grayText);
    }
    infoY -= logoImage ? 16 : 18;
    if (rawProfile.address) { drawText(String(rawProfile.address), startX, infoY, 8, font, grayText); infoY -= 11; }
    const contactParts: string[] = [];
    if (rawProfile.phone) contactParts.push("Tél : " + String(rawProfile.phone));
    if (rawProfile.email) contactParts.push(String(rawProfile.email));
    if (contactParts.length) { drawText(contactParts.join("  •  "), startX, infoY, 8, font, grayText); infoY -= 11; }
    if (rawProfile.siret) { drawText("SIRET : " + String(rawProfile.siret), startX, infoY, 8, font, grayText); infoY -= 11; }
    if (mentions.capital_rcs_mention) { drawText(mentions.capital_rcs_mention, startX, infoY, 7.5, font, grayText); infoY -= 11; }
    if (rawProfile.tva_intracom) { drawText("TVA : " + String(rawProfile.tva_intracom), startX, infoY, 8, font, grayText); infoY -= 11; }
    return infoY;
  };

  if (logoImage) {
    const logoDim = logoImage.scale(1);
    const maxH = 50;
    const maxW = 120;
    const scale = Math.min(maxW / logoDim.width, maxH / logoDim.height, 1);
    const w = logoDim.width * scale;
    const h = logoDim.height * scale;
    page.drawImage(logoImage, { x: margin, y: y - h + 4, width: w, height: h });
    artisanX = margin + w + 12;
    const bottom = drawArtisanInfo(artisanX, y - 4);
    y = Math.min(y - h - 4, bottom - 4);
  } else {
    const bottom = drawArtisanInfo(margin, y - 4);
    y = bottom - 4;
  }

  const clientName = [dossier.client_first_name, dossier.client_last_name].filter(Boolean).join(" ") || "Client";
  const boxW = 210;
  const boxX = pageWidth - margin - boxW;
  const boxTopY = headerStartY;

  page.drawRectangle({ x: boxX - 8, y: boxTopY - 78, width: boxW + 8, height: 86, color: lightBg });
  page.drawRectangle({ x: boxX - 8, y: boxTopY - 78, width: 3, height: 86, color: accent });

  drawText("DESTINATAIRE", boxX + 4, boxTopY - 6, 7, fontBold, grayText);
  drawText(clientName, boxX + 4, boxTopY - 20, 11, fontBold, darkText);
  let cY = boxTopY - 34;
  if (dossier.address) { drawText(truncate(String(dossier.address), 38), boxX + 4, cY, 8, font, grayText); cY -= 11; }
  if (dossier.client_email) { drawText(String(dossier.client_email), boxX + 4, cY, 8, font, grayText); cY -= 11; }
  if (dossier.client_phone) { drawText(String(dossier.client_phone), boxX + 4, cY, 8, font, grayText); cY -= 11; }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1.5, color: primary });
  y -= 20;

  const versionSuffix = (quote.version_number as number) > 1 ? ` — V${quote.version_number}` : "";
  drawText("DEVIS N° " + String(quote.quote_number) + versionSuffix, margin, y, 16, fontBold, primary);
  y -= 20;

  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  drawText("Date : " + dateStr, margin, y, 9, font, grayText);
  drawText("Validité : " + String(quote.validity_days || 30) + " jours", margin + 180, y, 9, font, grayText);
  y -= 13;

  if (dossier.address) {
    drawText("Lieu d'intervention : " + truncate(String(dossier.address), 65), margin, y, 9, font, grayText);
    y -= 13;
  }

  y -= 12;
  const colWidths = [contentWidth * 0.42, contentWidth * 0.10, contentWidth * 0.15, contentWidth * 0.13, contentWidth * 0.20];
  const colX = [margin];
  for (let i = 1; i < 5; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  const headerH = 24;
  page.drawRectangle({ x: margin, y: y - headerH + 6, width: contentWidth, height: headerH, color: primary });
  const headers = ["Désignation", "Qté", "PU HT", "TVA", "Total HT"];
  headers.forEach((h, i) => {
    const xOff = i === 0 ? 8 : colWidths[i] - font.widthOfTextAtSize(h, 8) - 6;
    drawText(h, colX[i] + xOff, y - 10, 8, fontBold, white);
  });
  y -= headerH + 2;

  let totalHt = 0;
  let totalTva = 0;
  let rowIdx = 0;

  for (const item of items) {
    const lt = calcLineTotal(item);
    const tva = mentions.vat_293b_mention ? 0 : (lt * item.vat_rate) / 100;
    totalHt += lt;
    totalTva += tva;

    const descLines = item.description ? wrapText(item.description, font, 7.5, colWidths[0] - 16) : [];
    const hasDiscount = (item.discount || 0) > 0;
    const rowH = 20 + descLines.length * 10 + (hasDiscount ? 10 : 0);
    addNewPageIfNeeded(rowH + 4);

    if (rowIdx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowH + 4, width: contentWidth, height: rowH, color: lightBg });
    }

    drawText(truncate(item.label, 45), colX[0] + 8, y - 6, 9, fontBold, darkText);
    descLines.forEach((line, li) => {
      drawText(line, colX[0] + 8, y - 17 - li * 10, 7.5, fontOblique, grayText);
    });
    if (hasDiscount) {
      const base = item.qty * item.unit_price;
      const dAmount = item.discount_unit === "EUR"
        ? Math.min(item.discount, base)
        : (base * item.discount) / 100;
      const dStr = item.discount_unit === "EUR"
        ? `Remise : -${fmt(dAmount)}`
        : `Remise : -${item.discount}% (-${fmt(dAmount)})`;
      drawText(dStr, colX[0] + 8, y - 17 - descLines.length * 10, 7, fontOblique, accent);
    }

    const qtyStr = item.qty + " " + item.unit;
    drawText(qtyStr, colX[1] + colWidths[1] - font.widthOfTextAtSize(qtyStr, 9) - 6, y - 6, 9, font, darkText);

    const puStr = fmt(item.unit_price);
    drawText(puStr, colX[2] + colWidths[2] - font.widthOfTextAtSize(puStr, 9) - 6, y - 6, 9, font, darkText);

    const tvaStr = mentions.vat_293b_mention ? "—" : item.vat_rate + " %";
    drawText(tvaStr, colX[3] + colWidths[3] - font.widthOfTextAtSize(tvaStr, 9) - 6, y - 6, 9, font, grayText);

    const totalStr = fmt(lt);
    drawText(totalStr, colX[4] + colWidths[4] - fontBold.widthOfTextAtSize(totalStr, 9) - 6, y - 6, 9, fontBold, primary);

    y -= rowH;
    rowIdx++;
  }

  page.drawLine({ start: { x: margin, y: y + 2 }, end: { x: margin + contentWidth, y: y + 2 }, thickness: 1, color: primary });

  y -= 14;
  addNewPageIfNeeded(80);
  const totalsW = 200;
  const totalsX = pageWidth - margin - totalsW;
  const totalTtc = totalHt + totalTva;

  page.drawRectangle({ x: totalsX - 8, y: y - 68, width: totalsW + 8, height: 72, color: lightBg });

  const drawTotalRow = (label: string, value: string, bold = false, highlight = false) => {
    const f = bold ? fontBold : font;
    const sz = bold ? 12 : 10;
    if (highlight) {
      page.drawRectangle({ x: totalsX - 8, y: y - 14, width: totalsW + 8, height: 20, color: primary });
      drawText(label, totalsX, y - 6, sz, f, white);
      drawText(value, totalsX + totalsW - f.widthOfTextAtSize(value, sz), y - 6, sz, f, white);
    } else {
      drawText(label, totalsX, y - 6, sz, f, grayText);
      drawText(value, totalsX + totalsW - f.widthOfTextAtSize(value, sz), y - 6, sz, f, darkText);
    }
    y -= 22;
  };

  drawTotalRow("Total HT", fmt(totalHt));
  if (!mentions.vat_293b_mention) drawTotalRow("TVA", fmt(totalTva));
  drawTotalRow("TOTAL TTC", fmt(totalTtc), true, true);

  if (mentions.vat_293b_mention) {
    y -= 4;
    drawText(mentions.vat_293b_mention, totalsX, y, 8, fontOblique, grayText);
    y -= 14;
  }

  // Acompte
  const depositType = quote.deposit_type as string | null;
  const depositValue = quote.deposit_value as number | null;
  if (depositType && depositValue && depositType !== "none") {
    y -= 6;
    addNewPageIfNeeded(20);
    const depositAmount = depositType === "percent" ? totalTtc * depositValue / 100 : depositValue;
    drawText(`Acompte demandé : ${fmt(depositAmount)}${depositType === "percent" ? ` (${depositValue}%)` : ""}`, margin, y, 9, fontBold, accent);
    y -= 14;
  }

  if (quote.notes) {
    y -= 10;
    addNewPageIfNeeded(70);
    drawText("Conditions et observations", margin, y, 10, fontBold, primary);
    y -= 14;
    const noteLines = String(quote.notes).split("\n").slice(0, 6);
    for (const line of noteLines) {
      const wrapped = wrapText(line, font, 8, contentWidth - 10);
      for (const wl of wrapped) {
        addNewPageIfNeeded(12);
        drawText(wl, margin + 4, y, 8, font, grayText);
        y -= 11;
      }
    }
  }

  // === MENTIONS LÉGALES AUTO ===
  y -= 16;
  addNewPageIfNeeded(110);
  page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: lineColor });
  y -= 6;

  drawText("Mentions légales", margin, y, 9, fontBold, primary);
  y -= 12;

  const legalLines: string[] = [];

  if (mentions.decennial_block) {
    legalLines.push(
      `Assurance décennale : ${mentions.decennial_block.insurer} — Police n° ${mentions.decennial_block.policy} — Couverture : ${mentions.decennial_block.coverage}.`,
    );
    legalLines.push(mentions.decennial_block.legal_text);
  }
  if (mentions.late_penalty_text) legalLines.push(mentions.late_penalty_text);
  if (mentions.recovery_fee_text) legalLines.push(mentions.recovery_fee_text);
  if (mentions.waste_mention) legalLines.push(mentions.waste_mention);
  legalLines.push("Le client dispose d'un délai de rétractation de 14 jours à compter de la signature du devis (art. L.221-18 du Code de la consommation).");
  if (mentions.iban_block) {
    legalLines.push(`Règlement par virement : IBAN ${mentions.iban_block.iban}${mentions.iban_block.bic ? ` — BIC ${mentions.iban_block.bic}` : ""}.`);
  }
  legalLines.push("Bon pour accord — Date et signature du client :");

  for (const m of legalLines) {
    const lines = wrapText(m, font, 7, contentWidth - 8);
    for (const l of lines) {
      addNewPageIfNeeded(10);
      drawText(l, margin + 4, y, 7, font, grayText);
      y -= 9;
    }
    y -= 2;
  }

  y -= 6;
  addNewPageIfNeeded(50);
  page.drawRectangle({ x: pageWidth - margin - 200, y: y - 40, width: 200, height: 44, borderWidth: 0.5, borderColor: lineColor, color: white });
  drawText("Signature client", pageWidth - margin - 190, y - 12, 8, fontOblique, grayText);

  const footerParts = [artisanDisplayName];
  if (rawProfile.siret) footerParts.push("SIRET " + String(rawProfile.siret));
  if (rawProfile.phone) footerParts.push("Tél " + String(rawProfile.phone));
  if (rawProfile.email) footerParts.push(String(rawProfile.email));
  const footerText = footerParts.join("  —  ");
  const footerWidth = font.widthOfTextAtSize(footerText, 7);

  const pages = doc.getPages();
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    p.drawLine({ start: { x: margin, y: 36 }, end: { x: pageWidth - margin, y: 36 }, thickness: 0.5, color: lineColor });
    p.drawText(footerText, { x: (pageWidth - footerWidth) / 2, y: 24, size: 7, font, color: grayText });
    const pageNum = `${i + 1}/${totalPages}`;
    p.drawText(pageNum, { x: pageWidth - margin - font.widthOfTextAtSize(pageNum, 7), y: 24, size: 7, font, color: grayText });
  }

  return await doc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quote_id } = await req.json();
    if (!quote_id) throw new Error("Missing quote_id");

    const { data: quote, error: qErr } = await supabase
      .from("quotes").select("*").eq("id", quote_id).eq("user_id", user.id).single();
    if (qErr || !quote) throw new Error("Devis introuvable");

    const [{ data: dossier }, complianceCtx] = await Promise.all([
      supabase.from("dossiers").select("*").eq("id", quote.dossier_id).single(),
      loadComplianceContext(supabase, user.id),
    ]);
    if (!dossier) throw new Error("Dossier introuvable");

    const { profile, insurance, settings, rawProfile } = complianceCtx;

    // === BACKEND VALIDATION (BLOCKING) ===
    if (settings?.block_generation_if_incomplete !== false) {
      const blockers = getMissingMandatoryFields(profile, insurance);
      if (!profile?.onboarding_compliance_completed_at) {
        blockers.unshift({ code: "onboarding_incomplete", message: "Onboarding conformité non terminé", section: "onboarding" });
      }
      if (blockers.length > 0) {
        return new Response(JSON.stringify({
          error: "Document non conforme : informations obligatoires manquantes",
          blockers,
        }), { status: 422, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    const customer: CustomerInfo = {
      type: "individual",
      first_name: dossier.client_first_name,
      last_name: dossier.client_last_name,
      email: dossier.client_email,
      address: dossier.address,
    };

    const mentions = profile
      ? buildLegalMentions(profile, insurance, settings, customer)
      : {
          ei_mention: null, vat_293b_mention: null, decennial_block: null,
          late_penalty_text: null, recovery_fee_text: null, waste_mention: null,
          capital_rcs_mention: null, iban_block: null,
        };

    const artisanDisplayName = profile ? getDisplayName(profile) : "Artisan";
    const items = (quote.items as QuoteItem[]) || [];
    const pdfBytes = await buildPdf(rawProfile || {}, dossier, quote, items, mentions, artisanDisplayName);

    const filePath = `${quote.dossier_id}/devis_${(quote.quote_number as string).replace(/[^a-zA-Z0-9-]/g, "_")}_v${quote.version_number || 1}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("dossier-medias")
      .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

    // === SNAPSHOT FIGÉ ===
    await supabase.from("quotes").update({
      pdf_url: urlData.publicUrl,
      legal_mentions_snapshot: mentions,
      compliance_snapshot: {
        generated_at: new Date().toISOString(),
        artisan: artisanDisplayName,
        siret: rawProfile?.siret ?? null,
        legal_form: profile?.legal_form ?? null,
        vat_applicable: profile?.vat_applicable ?? null,
      },
    }).eq("id", quote_id);

    await supabase.from("historique").insert({
      dossier_id: quote.dossier_id,
      user_id: user.id,
      action: "quote_pdf_generated",
      details: `PDF généré pour devis ${quote.quote_number}`,
    });

    return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in generate-quote-pdf:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
