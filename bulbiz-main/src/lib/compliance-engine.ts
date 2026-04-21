/**
 * Moteur de conformité documentaire France pour Bulbiz.
 * Calcule les scores, mentions légales auto et bloque la génération si données manquantes.
 *
 * IMPORTANT : ces règles doivent être dupliquées côté Edge Functions pour validation backend.
 */

export type LegalForm = "ei" | "micro" | "eurl" | "sarl" | "sasu" | "sas" | "autre";
export type CustomerType = "individual" | "business";

export interface ComplianceProfile {
  // Identité
  legal_form: LegalForm | null;
  company_name: string | null;
  trade_name: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  first_name: string | null;
  last_name: string | null;
  capital_amount: number | null;
  rcs_city: string | null;
  siren: string | null;
  siret: string | null;
  tva_intracom: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  // TVA
  vat_applicable: boolean;
  vat_exemption_293b: boolean;
  vat_on_debits: boolean;
  // Paiement
  iban: string | null;
  bic: string | null;
  accepted_payment_methods: string[] | null;
  payment_terms_default: string | null;
  late_penalty_rate: number | null;
  fixed_recovery_fee_b2b: boolean;
  // Onboarding
  onboarding_compliance_completed_at: string | null;
}

export interface InsuranceProfile {
  decennial_required: boolean;
  insurer_name: string | null;
  policy_number: string | null;
  insurer_contact: string | null;
  geographic_coverage: string | null;
  validity_start: string | null;
  validity_end: string | null;
  default_legal_text: string | null;
}

export interface ComplianceSettings {
  waste_management_text: string | null;
  default_quote_validity_days: number;
  block_generation_if_incomplete: boolean;
  auto_add_ei_mention: boolean;
  auto_add_293b_mention: boolean;
  auto_add_decennial_notice: boolean;
  auto_add_40eur_b2b: boolean;
  auto_add_waste_mention: boolean;
}

export interface CustomerInfo {
  type: CustomerType;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  email?: string | null;
  siren?: string | null;
  address?: string | null;
}

export interface LegalMentions {
  ei_mention: string | null;
  vat_293b_mention: string | null;
  decennial_block: { insurer: string; policy: string; coverage: string; legal_text: string } | null;
  late_penalty_text: string | null;
  recovery_fee_text: string | null;
  waste_mention: string | null;
  capital_rcs_mention: string | null;
  iban_block: { iban: string; bic?: string | null } | null;
}

export interface ValidationResult {
  ok: boolean;
  blockers: { code: string; message: string; section: string }[];
  warnings: { code: string; message: string }[];
}

// ==========================================
// SCORE
// ==========================================

export function computeComplianceScore(
  profile: ComplianceProfile | null,
  insurance: InsuranceProfile | null,
  settings: ComplianceSettings | null,
): number {
  if (!profile) return 0;
  let score = 0;
  const max = 100;

  // Identité légale (30 pts)
  if (profile.legal_form) score += 6;
  if (profile.company_name || (profile.first_name && profile.last_name)) score += 6;
  if (profile.siret) score += 6;
  if (profile.siren) score += 3;
  if (profile.address) score += 6;
  if (isSocietaire(profile.legal_form)) {
    if (profile.capital_amount) score += 1.5;
    if (profile.rcs_city) score += 1.5;
  } else {
    score += 3;
  }

  // TVA (10 pts)
  if (profile.vat_applicable !== null) score += 5;
  if (profile.vat_applicable && profile.tva_intracom) score += 5;
  else if (!profile.vat_applicable) score += 5;

  // Assurance (15 pts)
  if (insurance) {
    if (!insurance.decennial_required) score += 15;
    else {
      if (insurance.insurer_name) score += 5;
      if (insurance.policy_number) score += 5;
      if (insurance.geographic_coverage) score += 5;
    }
  }

  // Paiement (20 pts)
  if (profile.iban) score += 8;
  if (profile.payment_terms_default) score += 4;
  if (profile.accepted_payment_methods && profile.accepted_payment_methods.length > 0) score += 4;
  if (profile.late_penalty_rate) score += 4;

  // Contact (10 pts)
  if (profile.email) score += 5;
  if (profile.phone) score += 5;

  // Réglages conformité (15 pts)
  if (settings) score += 15;

  return Math.min(max, Math.round(score));
}

// ==========================================
// HELPERS
// ==========================================

export function isSocietaire(legalForm: LegalForm | null): boolean {
  return legalForm === "eurl" || legalForm === "sarl" || legalForm === "sasu" || legalForm === "sas";
}

export function isEntrepreneurIndividuel(legalForm: LegalForm | null): boolean {
  return legalForm === "ei" || legalForm === "micro";
}

export function getDisplayName(profile: ComplianceProfile): string {
  if (profile.company_name) return profile.company_name;
  if (profile.trade_name) return profile.trade_name;
  const fn = profile.owner_first_name || profile.first_name;
  const ln = profile.owner_last_name || profile.last_name;
  return [fn, ln].filter(Boolean).join(" ") || "—";
}

// ==========================================
// MENTIONS LÉGALES AUTO
// ==========================================

export function buildLegalMentions(
  profile: ComplianceProfile,
  insurance: InsuranceProfile | null,
  settings: ComplianceSettings | null,
  customer: CustomerInfo | null,
): LegalMentions {
  const m: LegalMentions = {
    ei_mention: null,
    vat_293b_mention: null,
    decennial_block: null,
    late_penalty_text: null,
    recovery_fee_text: null,
    waste_mention: null,
    capital_rcs_mention: null,
    iban_block: null,
  };

  // Mention EI
  if (
    settings?.auto_add_ei_mention !== false &&
    isEntrepreneurIndividuel(profile.legal_form)
  ) {
    m.ei_mention = "Entrepreneur Individuel (EI)";
  }

  // Mention TVA 293B
  if (
    settings?.auto_add_293b_mention !== false &&
    !profile.vat_applicable
  ) {
    m.vat_293b_mention = "TVA non applicable, art. 293 B du CGI";
  }

  // Capital social + RCS
  if (isSocietaire(profile.legal_form) && (profile.capital_amount || profile.rcs_city)) {
    const parts: string[] = [];
    if (profile.legal_form) parts.push(profile.legal_form.toUpperCase());
    if (profile.capital_amount) parts.push(`au capital de ${profile.capital_amount.toLocaleString("fr-FR")} €`);
    if (profile.rcs_city) parts.push(`RCS ${profile.rcs_city}`);
    if (profile.siren) parts.push(`SIREN ${profile.siren}`);
    m.capital_rcs_mention = parts.join(" — ");
  }

  // Décennale
  if (
    settings?.auto_add_decennial_notice !== false &&
    insurance?.decennial_required &&
    insurance.insurer_name &&
    insurance.policy_number
  ) {
    m.decennial_block = {
      insurer: insurance.insurer_name,
      policy: insurance.policy_number,
      coverage: insurance.geographic_coverage || "France métropolitaine",
      legal_text:
        insurance.default_legal_text ||
        "Assurance Responsabilité Civile Décennale conformément à l'article L.241-1 du Code des assurances.",
    };
  }

  // Pénalités de retard et indemnité 40 € (B2B uniquement)
  if (customer?.type === "business") {
    const rate = profile.late_penalty_rate ?? 10.49;
    m.late_penalty_text = `Pénalités de retard : ${rate.toString().replace(".", ",")} % (taux légal majoré). Aucun escompte pour paiement anticipé sauf mention contraire.`;
    if (settings?.auto_add_40eur_b2b !== false && profile.fixed_recovery_fee_b2b) {
      m.recovery_fee_text = "Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du Code de commerce).";
    }
  }

  // Déchets
  if (settings?.auto_add_waste_mention && settings.waste_management_text) {
    m.waste_mention = settings.waste_management_text;
  }

  // IBAN
  if (profile.iban) {
    m.iban_block = { iban: profile.iban, bic: profile.bic };
  }

  return m;
}

// ==========================================
// CHAMPS OBLIGATOIRES
// ==========================================

export function getMissingMandatoryFields(
  profile: ComplianceProfile | null,
  insurance: InsuranceProfile | null,
  _settings: ComplianceSettings | null,
): { code: string; message: string; section: string }[] {
  const missing: { code: string; message: string; section: string }[] = [];
  if (!profile) {
    missing.push({ code: "profile_missing", message: "Profil entreprise manquant", section: "identity" });
    return missing;
  }

  if (!profile.legal_form)
    missing.push({ code: "legal_form", message: "Forme juridique non renseignée", section: "identity" });
  if (!profile.siret)
    missing.push({ code: "siret", message: "SIRET manquant", section: "identity" });
  if (!profile.company_name && !(profile.first_name && profile.last_name))
    missing.push({ code: "company_name", message: "Raison sociale ou nom du dirigeant requis", section: "identity" });
  if (!profile.address)
    missing.push({ code: "address", message: "Adresse du siège manquante", section: "identity" });
  if (!profile.email)
    missing.push({ code: "email", message: "Email professionnel manquant", section: "identity" });

  if (isSocietaire(profile.legal_form)) {
    if (!profile.capital_amount)
      missing.push({ code: "capital", message: "Capital social manquant (société)", section: "identity" });
    if (!profile.rcs_city)
      missing.push({ code: "rcs_city", message: "Ville RCS manquante (société)", section: "identity" });
  }

  if (profile.vat_applicable && !profile.tva_intracom)
    missing.push({ code: "tva_intracom", message: "Numéro de TVA intracommunautaire manquant", section: "vat" });

  if (insurance?.decennial_required) {
    if (!insurance.insurer_name)
      missing.push({ code: "insurer", message: "Nom de l'assureur décennale manquant", section: "insurance" });
    if (!insurance.policy_number)
      missing.push({ code: "policy", message: "Numéro de police d'assurance manquant", section: "insurance" });
  }

  if (!profile.iban)
    missing.push({ code: "iban", message: "IBAN manquant", section: "payment" });
  if (!profile.payment_terms_default)
    missing.push({ code: "payment_terms", message: "Délai/conditions de règlement par défaut manquants", section: "payment" });

  return missing;
}

// ==========================================
// VALIDATION DEVIS
// ==========================================

export interface QuoteValidationInput {
  items: { label?: string; quantity?: number; unit_price?: number }[] | unknown[];
  total_ttc: number | null;
  validity_days: number | null;
  customer: CustomerInfo | null;
}

export function validateQuoteForGeneration(
  quote: QuoteValidationInput,
  profile: ComplianceProfile | null,
  insurance: InsuranceProfile | null,
  settings: ComplianceSettings | null,
): ValidationResult {
  const blockers = getMissingMandatoryFields(profile, insurance, settings);
  const warnings: { code: string; message: string }[] = [];

  if (!profile?.onboarding_compliance_completed_at) {
    blockers.unshift({
      code: "onboarding_incomplete",
      message: "Onboarding conformité non terminé",
      section: "onboarding",
    });
  }

  if (!quote.items || quote.items.length === 0) {
    blockers.push({ code: "no_items", message: "Aucune ligne de devis", section: "items" });
  }
  if (!quote.validity_days || quote.validity_days < 1) {
    blockers.push({ code: "validity", message: "Durée de validité du devis manquante", section: "items" });
  }
  if (!quote.customer || (!quote.customer.first_name && !quote.customer.company)) {
    blockers.push({ code: "customer", message: "Client non renseigné", section: "customer" });
  }
  if (quote.customer?.type === "business" && !quote.customer.siren) {
    warnings.push({
      code: "customer_siren",
      message: "SIREN client manquant (recommandé pour la facturation électronique).",
    });
  }

  return { ok: blockers.length === 0, blockers, warnings };
}

// ==========================================
// VALIDATION FACTURE
// ==========================================

export interface InvoiceValidationInput {
  lines: { label?: string }[] | unknown[];
  total_ttc: number | null;
  due_date: string | null;
  customer: CustomerInfo | null;
  invoice_type?: string;
}

export function validateInvoiceForGeneration(
  invoice: InvoiceValidationInput,
  profile: ComplianceProfile | null,
  insurance: InsuranceProfile | null,
  settings: ComplianceSettings | null,
): ValidationResult {
  const blockers = getMissingMandatoryFields(profile, insurance, settings);
  const warnings: { code: string; message: string }[] = [];

  if (!profile?.onboarding_compliance_completed_at) {
    blockers.unshift({
      code: "onboarding_incomplete",
      message: "Onboarding conformité non terminé",
      section: "onboarding",
    });
  }

  if (!invoice.lines || invoice.lines.length === 0) {
    blockers.push({ code: "no_lines", message: "Aucune ligne sur la facture", section: "items" });
  }
  if (!invoice.customer || (!invoice.customer.first_name && !invoice.customer.company)) {
    blockers.push({ code: "customer", message: "Client non renseigné", section: "customer" });
  }
  if (invoice.customer?.type === "business" && !invoice.customer.siren) {
    blockers.push({
      code: "customer_siren_b2b",
      message: "SIREN du client professionnel obligatoire sur la facture",
      section: "customer",
    });
  }
  if (!invoice.due_date) {
    warnings.push({ code: "due_date", message: "Date d'échéance non renseignée." });
  }

  return { ok: blockers.length === 0, blockers, warnings };
}
