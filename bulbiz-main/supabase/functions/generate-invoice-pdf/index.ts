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

interface InvoiceLine {
  label: string;
  description?: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  discount: number;
  discount_unit?: "PERCENT" | "EUR";
  sort_order: number;
}

function calcLineTotal(item: InvoiceLine): number {
  const base = item.qty * item.unit_price;
  const d = item.discount || 0;
  if (item.discount_unit === "EUR") return Math.max(0, base - d);
  return base - (base * d) / 100;
}

/**
 * pdf-lib StandardFonts (Helvetica) ne supportent que WinAnsi.
 * On remplace les caractères Unicode courants (NBSP étroit U+202F, espace fine U+2009,
 * tirets cadratins, guillemets typographiques, etc.) par leurs équivalents WinAnsi.
 */
function sanitizeWinAnsi(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/[\u00A0\u202F\u2007\u2009\u200A\u200B\u2060]/g, " ") // espaces insécables / fines
    .replace(/[\u2013\u2014\u2212]/g, "-") // tirets longs / signe moins
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'") // apostrophes typographiques
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"') // guillemets typographiques
    .replace(/\u2026/g, "...") // ellipse
    .replace(/[\u2022\u00B7]/g, "-") // puces / middle dot → tiret (WinAnsi safe)
    // WinAnsi étendu (octets 0x80–0x9F) — sans cette mappe explicite, le filet de sécurité
    // ci-dessous remplacerait `€`, `œ`, `Œ`, etc. par `?` (codepoints > 0xFF en Unicode).
    .replace(/€/g, "\x80")
    .replace(/ƒ/g, "\x83")
    .replace(/Š/g, "\x8A").replace(/š/g, "\x9A")
    .replace(/Œ/g, "\x8C").replace(/œ/g, "\x9C")
    .replace(/Ž/g, "\x8E").replace(/ž/g, "\x9E")
    .replace(/Ÿ/g, "\x9F")
    .replace(/[^\x00-\xFF]/g, "?"); // tout autre caractère hors WinAnsi → "?"
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
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

function invoiceTitle(invoiceType: string): string {
  switch (invoiceType) {
    case "credit_note": return "AVOIR";
    case "deposit": return "FACTURE D'ACOMPTE";
    case "final": return "FACTURE";
    default: return "FACTURE";
  }
}

async function buildInvoicePdf(
  rawProfile: Record<string, unknown>,
  invoice: Record<string, unknown>,
  lines: InvoiceLine[],
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
  const footerZone = 50;

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
    if (y - needed < margin + footerZone) {
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

  if (logoImage) {
    const logoDim = logoImage.scale(1);
    const maxH = 50;
    const maxW = 120;
    const scale = Math.min(maxW / logoDim.width, maxH / logoDim.height, 1);
    const w = logoDim.width * scale;
    const h = logoDim.height * scale;
    page.drawImage(logoImage, { x: margin, y: y - h + 4, width: w, height: h });
    artisanX = margin + w + 12;
  }

  const drawArtisanInfo = (startX: number) => {
    drawText(artisanDisplayName, startX, y - 4, logoImage ? 14 : 16, fontBold, primary);
    if (mentions.ei_mention) {
      const w = fontBold.widthOfTextAtSize(artisanDisplayName, logoImage ? 14 : 16);
      drawText(" — " + mentions.ei_mention, startX + w, y - 4, 8, fontOblique, grayText);
    }
    let infoY = y - (logoImage ? 20 : 22);
    if (rawProfile.address) { drawText(String(rawProfile.address), startX, infoY, 8, font, grayText); infoY -= 11; }
    const contactParts: string[] = [];
    if (rawProfile.phone) contactParts.push("Tél : " + String(rawProfile.phone));
    if (rawProfile.email) contactParts.push(String(rawProfile.email));
    if (contactParts.length) { drawText(contactParts.join("  •  "), startX, infoY, 8, font, grayText); infoY -= 11; }
    if (rawProfile.siret) { drawText("SIRET : " + String(rawProfile.siret), startX, infoY, 8, font, grayText); infoY -= 11; }
    if (mentions.capital_rcs_mention) { drawText(mentions.capital_rcs_mention, startX, infoY, 7.5, font, grayText); infoY -= 11; }
    if (rawProfile.tva_intracom) { drawText("TVA Intracom. : " + String(rawProfile.tva_intracom), startX, infoY, 8, font, grayText); infoY -= 11; }
    return infoY;
  };

  const bottomInfo = drawArtisanInfo(artisanX);
  y = Math.min(logoImage ? y - 54 : bottomInfo, bottomInfo) - 4;

  const clientName = [invoice.client_first_name, invoice.client_last_name].filter(Boolean).join(" ") ||
    (invoice.client_company as string) || "Client";
  const boxW = 210;
  const boxX = pageWidth - margin - boxW;
  const boxTopY = headerStartY;

  page.drawRectangle({ x: boxX - 8, y: boxTopY - 92, width: boxW + 8, height: 100, color: lightBg });
  page.drawRectangle({ x: boxX - 8, y: boxTopY - 92, width: 3, height: 100, color: accent });

  drawText("CLIENT", boxX + 4, boxTopY - 6, 7, fontBold, grayText);
  if (invoice.client_company) {
    drawText(String(invoice.client_company), boxX + 4, boxTopY - 20, 10, fontBold, darkText);
    drawText(clientName, boxX + 4, boxTopY - 32, 9, font, darkText);
  } else {
    drawText(clientName, boxX + 4, boxTopY - 20, 11, fontBold, darkText);
  }
  let cY = boxTopY - (invoice.client_company ? 44 : 34);
  if (invoice.client_address) { drawText(truncate(String(invoice.client_address), 38), boxX + 4, cY, 8, font, grayText); cY -= 11; }
  if (invoice.client_email) { drawText(String(invoice.client_email), boxX + 4, cY, 8, font, grayText); cY -= 11; }
  if (invoice.client_phone) { drawText(String(invoice.client_phone), boxX + 4, cY, 8, font, grayText); cY -= 11; }
  if (invoice.customer_siren) { drawText("SIREN : " + String(invoice.customer_siren), boxX + 4, cY, 7.5, font, grayText); cY -= 11; }

  // Worksite address
  if (invoice.worksite_address && invoice.worksite_address !== invoice.client_address) {
    y -= 4;
    drawText("Lieu d'intervention : " + truncate(String(invoice.worksite_address), 70), margin, y, 8, fontOblique, grayText);
    y -= 11;
  }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1.5, color: primary });
  y -= 20;

  const versionSuffix = (invoice.version_number as number) > 1 ? ` — V${invoice.version_number}` : "";
  const title = invoiceTitle((invoice.invoice_type as string) || "standalone");
  drawText(title + " N° " + String(invoice.invoice_number) + versionSuffix, margin, y, 16, fontBold, primary);
  y -= 20;

  drawText("Date d'émission : " + formatDate(invoice.issue_date as string), margin, y, 9, font, grayText);
  if (invoice.service_date) {
    drawText("Date d'intervention : " + formatDate(invoice.service_date as string), margin + 220, y, 9, font, grayText);
  }
  y -= 13;
  if (invoice.due_date) {
    drawText("Échéance : " + formatDate(invoice.due_date as string), margin, y, 9, font, grayText);
    y -= 13;
  }

  y -= 6;
  const colWidths = [contentWidth * 0.36, contentWidth * 0.08, contentWidth * 0.08, contentWidth * 0.14, contentWidth * 0.12, contentWidth * 0.22];
  const colX = [margin];
  for (let i = 1; i < 6; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  const headerH = 24;
  page.drawRectangle({ x: margin, y: y - headerH + 6, width: contentWidth, height: headerH, color: primary });
  const headers = ["Désignation", "Qté", "Unité", "PU HT", "TVA %", "Total HT"];
  headers.forEach((h, i) => {
    const xOff = i === 0 ? 8 : colWidths[i] - font.widthOfTextAtSize(h, 7.5) - 4;
    drawText(h, colX[i] + xOff, y - 10, 7.5, fontBold, white);
  });
  y -= headerH + 2;

  let totalHt = 0;
  const tvaByRate: Record<number, number> = {};
  let rowIdx = 0;
  const isCreditNote = invoice.invoice_type === "credit_note";
  const sign = isCreditNote ? -1 : 1;

  for (const item of lines) {
    const lt = calcLineTotal(item) * sign;
    totalHt += lt;
    if (!mentions.vat_293b_mention) {
      const tvaAmount = lt * item.tva_rate / 100;
      tvaByRate[item.tva_rate] = (tvaByRate[item.tva_rate] || 0) + tvaAmount;
    }

    const descLines = item.description ? wrapText(item.description, font, 7, colWidths[0] - 16) : [];
    const hasDiscount = (item.discount || 0) > 0;
    const rowH = 20 + descLines.length * 10 + (hasDiscount ? 10 : 0);
    addNewPageIfNeeded(rowH + 4);

    if (rowIdx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowH + 4, width: contentWidth, height: rowH, color: lightBg });
    }

    drawText(truncate(item.label, 42), colX[0] + 8, y - 6, 8.5, fontBold, darkText);
    descLines.forEach((line, li) => {
      drawText(line, colX[0] + 8, y - 17 - li * 10, 7, fontOblique, grayText);
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

    const qtyStr = String(item.qty);
    drawText(qtyStr, colX[1] + colWidths[1] - font.widthOfTextAtSize(qtyStr, 8.5) - 4, y - 6, 8.5, font, darkText);
    drawText(item.unit, colX[2] + 4, y - 6, 8.5, font, grayText);

    const puStr = fmt(item.unit_price);
    drawText(puStr, colX[3] + colWidths[3] - font.widthOfTextAtSize(puStr, 8.5) - 4, y - 6, 8.5, font, darkText);

    const tvaStr = mentions.vat_293b_mention ? "—" : item.tva_rate + " %";
    drawText(tvaStr, colX[4] + colWidths[4] - font.widthOfTextAtSize(tvaStr, 8.5) - 4, y - 6, 8.5, font, grayText);

    const totalStr = fmt(lt);
    drawText(totalStr, colX[5] + colWidths[5] - fontBold.widthOfTextAtSize(totalStr, 8.5) - 4, y - 6, 8.5, fontBold, primary);

    y -= rowH;
    rowIdx++;
  }

  page.drawLine({ start: { x: margin, y: y + 2 }, end: { x: margin + contentWidth, y: y + 2 }, thickness: 1, color: primary });

  y -= 14;
  addNewPageIfNeeded(120);
  const totalsW = 220;
  const totalsX = pageWidth - margin - totalsW;

  const totalTva = Object.values(tvaByRate).reduce((a, b) => a + b, 0);
  const totalTtc = totalHt + totalTva;

  const totalRows = 2 + Object.keys(tvaByRate).length + 1;
  page.drawRectangle({ x: totalsX - 8, y: y - 22 * totalRows + 8, width: totalsW + 8, height: 22 * totalRows + 4, color: lightBg });

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

  if (!mentions.vat_293b_mention) {
    const rates = Object.keys(tvaByRate).map(Number).sort();
    for (const rate of rates) {
      drawTotalRow(`TVA ${rate} %`, fmt(tvaByRate[rate]));
    }
  }

  drawTotalRow(isCreditNote ? "MONTANT À REMBOURSER" : "TOTAL TTC", fmt(totalTtc), true, true);

  if (mentions.vat_293b_mention) {
    y -= 4;
    drawText(mentions.vat_293b_mention, totalsX, y, 8, fontOblique, grayText);
    y -= 14;
  }

  // === LEGAL MENTIONS AUTO ===
  y -= 16;
  addNewPageIfNeeded(140);
  page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: lineColor });
  y -= 6;

  drawText("Conditions et mentions légales", margin, y, 9, fontBold, primary);
  y -= 14;

  const legalLines: string[] = [];
  if (invoice.payment_terms) legalLines.push("Conditions de paiement : " + String(invoice.payment_terms));
  else legalLines.push("Conditions de paiement : paiement à réception de facture.");

  if (invoice.due_date) {
    legalLines.push("Date limite de paiement : " + formatDate(invoice.due_date as string));
  }

  if (mentions.decennial_block) {
    legalLines.push(
      `Assurance décennale : ${mentions.decennial_block.insurer} — Police n° ${mentions.decennial_block.policy} — Couverture : ${mentions.decennial_block.coverage}.`,
    );
    legalLines.push(mentions.decennial_block.legal_text);
  }
  if (mentions.late_penalty_text) legalLines.push(mentions.late_penalty_text);
  if (mentions.recovery_fee_text) legalLines.push(mentions.recovery_fee_text);
  if (mentions.waste_mention) legalLines.push(mentions.waste_mention);
  if (mentions.iban_block) {
    legalLines.push(`Règlement par virement : IBAN ${mentions.iban_block.iban}${mentions.iban_block.bic ? ` — BIC ${mentions.iban_block.bic}` : ""}.`);
  }
  if (invoice.invoice_type === "credit_note") {
    legalLines.push("Avoir émis en remboursement de la facture initiale. Aucune TVA n'est due au titre de cet avoir si la facture initiale a été régularisée.");
  }

  for (const m of legalLines) {
    const wrapped = wrapText(m, font, 7.5, contentWidth - 8);
    for (const l of wrapped) {
      addNewPageIfNeeded(11);
      drawText(l, margin + 4, y, 7.5, font, grayText);
      y -= 10;
    }
    y -= 3;
  }

  if (invoice.notes) {
    y -= 8;
    addNewPageIfNeeded(50);
    drawText("Notes", margin, y, 9, fontBold, primary);
    y -= 14;
    const noteLines = String(invoice.notes).split("\n").slice(0, 6);
    for (const line of noteLines) {
      const wrapped = wrapText(line, font, 8, contentWidth - 10);
      for (const wl of wrapped) {
        addNewPageIfNeeded(12);
        drawText(wl, margin + 4, y, 8, font, grayText);
        y -= 11;
      }
    }
  }

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

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("Missing invoice_id");

    const { data: invoice, error: invErr } = await supabase
      .from("invoices").select("*").eq("id", invoice_id).eq("user_id", user.id).single();
    if (invErr || !invoice) throw new Error("Facture introuvable");

    const [{ data: linesData }, complianceCtx] = await Promise.all([
      supabase.from("invoice_lines").select("*").eq("invoice_id", invoice_id).order("sort_order"),
      loadComplianceContext(supabase, user.id),
    ]);

    const { profile, insurance, settings, rawProfile } = complianceCtx;

    // === BACKEND VALIDATION (BLOCKING) ===
    if (settings?.block_generation_if_incomplete !== false) {
      const blockers = getMissingMandatoryFields(profile, insurance);
      if (!profile?.onboarding_compliance_completed_at) {
        blockers.unshift({ code: "onboarding_incomplete", message: "Onboarding conformité non terminé", section: "onboarding" });
      }
      if (invoice.client_type === "business" && !invoice.customer_siren) {
        blockers.push({ code: "customer_siren_b2b", message: "SIREN du client professionnel obligatoire", section: "customer" });
      }
      if (blockers.length > 0) {
        return new Response(JSON.stringify({
          error: "Document non conforme : informations obligatoires manquantes",
          blockers,
        }), { status: 422, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    const customer: CustomerInfo = {
      type: (invoice.client_type as "individual" | "business") || "individual",
      first_name: invoice.client_first_name,
      last_name: invoice.client_last_name,
      company: invoice.client_company,
      email: invoice.client_email,
      siren: invoice.customer_siren,
      address: invoice.client_address,
    };

    const mentions = profile
      ? buildLegalMentions(profile, insurance, settings, customer)
      : {
          ei_mention: null, vat_293b_mention: null, decennial_block: null,
          late_penalty_text: null, recovery_fee_text: null, waste_mention: null,
          capital_rcs_mention: null, iban_block: null,
        };

    const artisanDisplayName = profile ? getDisplayName(profile) : "Artisan";
    const lines = (linesData || []) as InvoiceLine[];
    const pdfBytes = await buildInvoicePdf(rawProfile || {}, invoice, lines, mentions, artisanDisplayName);

    const docTypePrefix = invoice.invoice_type === "credit_note" ? "avoir" :
                          invoice.invoice_type === "deposit" ? "acompte" : "facture";
    const filePath = `${invoice.dossier_id}/${docTypePrefix}_${(invoice.invoice_number as string).replace(/[^a-zA-Z0-9-]/g, "_")}_v${invoice.version_number || 1}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("dossier-medias")
      .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

    await supabase.from("invoices").update({
      pdf_url: urlData.publicUrl,
      legal_mentions_snapshot: mentions,
      compliance_snapshot: {
        generated_at: new Date().toISOString(),
        artisan: artisanDisplayName,
        siret: rawProfile?.siret ?? null,
        legal_form: profile?.legal_form ?? null,
        vat_applicable: profile?.vat_applicable ?? null,
        invoice_type: invoice.invoice_type,
      },
    }).eq("id", invoice_id);

    await supabase.from("historique").insert({
      dossier_id: invoice.dossier_id,
      user_id: user.id,
      action: "invoice_pdf_generated",
      details: `PDF généré pour ${docTypePrefix} ${invoice.invoice_number}`,
    });

    return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in generate-invoice-pdf:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
