import type { Invoice, InvoiceLine } from "@/hooks/useInvoices";

export interface ComplianceBlocker {
  code: string;
  message: string;
  section: string;
}

export interface ComplianceWarning {
  code: string;
  message: string;
  section: string;
}

export interface InvoiceValidation {
  ok: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceWarning[];
}

/**
 * Validation conformité France pour facture (CGI, Code de commerce L441-9, L441-10).
 * - Numéro unique chronologique
 * - Date d'émission + date prestation
 * - Identité émetteur (SIRET) + client
 * - Lignes détaillées (qty, PU, TVA)
 * - Mentions B2B (pénalités, indemnité 40 €)
 */
export function validateInvoiceForGeneration(
  invoice: Partial<Invoice> | null | undefined,
  lines: InvoiceLine[],
  options?: { strictB2B?: boolean }
): InvoiceValidation {
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceWarning[] = [];

  if (!invoice) {
    blockers.push({ code: "NO_INVOICE", message: "Facture introuvable", section: "Facture" });
    return { ok: false, blockers, warnings };
  }

  // Numéro
  if (!invoice.invoice_number || !invoice.invoice_number.trim()) {
    blockers.push({ code: "NO_NUMBER", message: "Numéro de facture obligatoire (chronologique)", section: "En-tête" });
  }

  // Date d'émission
  if (!invoice.issue_date) {
    blockers.push({ code: "NO_ISSUE_DATE", message: "Date d'émission obligatoire", section: "En-tête" });
  }

  // Émetteur
  if (!invoice.artisan_name && !invoice.artisan_company) {
    blockers.push({ code: "NO_ISSUER", message: "Identité de l'émetteur (nom ou société) obligatoire", section: "Émetteur" });
  }
  if (!invoice.artisan_siret) {
    warnings.push({ code: "NO_SIRET", message: "SIRET de l'émetteur recommandé", section: "Émetteur" });
  }
  if (!invoice.artisan_address) {
    warnings.push({ code: "NO_ISSUER_ADDR", message: "Adresse de l'émetteur recommandée", section: "Émetteur" });
  }

  // Client
  const hasClientName =
    !!(invoice.client_first_name?.trim() || invoice.client_last_name?.trim() || invoice.client_company?.trim());
  if (!hasClientName) {
    blockers.push({ code: "NO_CLIENT_NAME", message: "Nom ou société du client obligatoire", section: "Client" });
  }
  if (!invoice.client_address) {
    warnings.push({ code: "NO_CLIENT_ADDR", message: "Adresse du client recommandée", section: "Client" });
  }

  // Lignes
  if (!lines || lines.length === 0) {
    blockers.push({ code: "NO_LINES", message: "Au moins une ligne de prestation obligatoire", section: "Lignes" });
  } else {
    const invalidLines = lines.filter(
      (l) => !l.label?.trim() || l.qty <= 0 || l.unit_price < 0
    );
    if (invalidLines.length > 0) {
      blockers.push({
        code: "INVALID_LINES",
        message: `${invalidLines.length} ligne(s) invalide(s) — chaque ligne doit avoir une désignation, qté > 0 et PU ≥ 0`,
        section: "Lignes",
      });
    }
  }

  // Date prestation (CGI : recommandée pour services)
  if (!invoice.service_date) {
    warnings.push({
      code: "NO_SERVICE_DATE",
      message: "Date de prestation recommandée (date de fin d'intervention)",
      section: "Prestation",
    });
  }

  // B2B : pénalités + indemnité 40 €
  const isB2B = invoice.client_type === "business" || !!invoice.customer_siren || !!invoice.client_company;
  if (isB2B) {
    if (!invoice.late_fees_text) {
      const sev = options?.strictB2B ? blockers : warnings;
      sev.push({
        code: "NO_LATE_FEES",
        message: "Mention pénalités de retard + indemnité forfaitaire 40 € obligatoire en B2B",
        section: "Mentions légales",
      });
    }
    if (!invoice.payment_terms) {
      warnings.push({
        code: "NO_PAYMENT_TERMS",
        message: "Conditions de règlement recommandées en B2B",
        section: "Paiement",
      });
    }
  }

  // TVA non applicable (franchise 293B) → mention obligatoire
  if (invoice.vat_mode === "no_vat_293b") {
    warnings.push({
      code: "VAT_293B",
      message: "Mention « TVA non applicable, art. 293 B du CGI » sera ajoutée automatiquement",
      section: "TVA",
    });
  }

  return { ok: blockers.length === 0, blockers, warnings };
}