/**
 * Moteur de conformité partagé Edge Functions (Deno).
 * Doit rester aligné avec src/lib/compliance-engine.ts.
 */

export type LegalForm = "ei" | "micro" | "eurl" | "sarl" | "sasu" | "sas" | "autre";
export type CustomerType = "individual" | "business";

export interface ComplianceProfile {
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
  vat_applicable: boolean;
  vat_exemption_293b: boolean;
  vat_on_debits: boolean;
  iban: string | null;
  bic: string | null;
  accepted_payment_methods: string[] | null;
  payment_terms_default: string | null;
  late_penalty_rate: number | null;
  fixed_recovery_fee_b2b: boolean;
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

  if (settings?.auto_add_ei_mention !== false && isEntrepreneurIndividuel(profile.legal_form)) {
    m.ei_mention = "Entrepreneur Individuel (EI)";
  }

  if (settings?.auto_add_293b_mention !== false && !profile.vat_applicable) {
    m.vat_293b_mention = "TVA non applicable, art. 293 B du CGI";
  }

  if (isSocietaire(profile.legal_form) && (profile.capital_amount || profile.rcs_city)) {
    const parts: string[] = [];
    if (profile.legal_form) parts.push(profile.legal_form.toUpperCase());
    if (profile.capital_amount) parts.push(`au capital de ${profile.capital_amount.toLocaleString("fr-FR")} €`);
    if (profile.rcs_city) parts.push(`RCS ${profile.rcs_city}`);
    if (profile.siren) parts.push(`SIREN ${profile.siren}`);
    m.capital_rcs_mention = parts.join(" — ");
  }

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

  if (customer?.type === "business") {
    const rate = profile.late_penalty_rate ?? 10.49;
    m.late_penalty_text = `Pénalités de retard : ${rate.toString().replace(".", ",")} % (taux légal majoré). Aucun escompte pour paiement anticipé sauf mention contraire.`;
    if (settings?.auto_add_40eur_b2b !== false && profile.fixed_recovery_fee_b2b) {
      m.recovery_fee_text = "Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du Code de commerce).";
    }
  }

  if (settings?.auto_add_waste_mention && settings.waste_management_text) {
    m.waste_mention = settings.waste_management_text;
  }

  if (profile.iban) {
    m.iban_block = { iban: profile.iban, bic: profile.bic };
  }

  return m;
}

export interface MissingField { code: string; message: string; section: string }

export function getMissingMandatoryFields(
  profile: ComplianceProfile | null,
  insurance: InsuranceProfile | null,
): MissingField[] {
  const missing: MissingField[] = [];
  if (!profile) {
    missing.push({ code: "profile_missing", message: "Profil entreprise manquant", section: "identity" });
    return missing;
  }

  if (!profile.legal_form) missing.push({ code: "legal_form", message: "Forme juridique non renseignée", section: "identity" });
  if (!profile.siret) missing.push({ code: "siret", message: "SIRET manquant", section: "identity" });
  if (!profile.company_name && !(profile.first_name && profile.last_name))
    missing.push({ code: "company_name", message: "Raison sociale ou nom du dirigeant requis", section: "identity" });
  if (!profile.address) missing.push({ code: "address", message: "Adresse du siège manquante", section: "identity" });
  if (!profile.email) missing.push({ code: "email", message: "Email professionnel manquant", section: "identity" });

  if (isSocietaire(profile.legal_form)) {
    if (!profile.capital_amount) missing.push({ code: "capital", message: "Capital social manquant (société)", section: "identity" });
    if (!profile.rcs_city) missing.push({ code: "rcs_city", message: "Ville RCS manquante (société)", section: "identity" });
  }

  if (profile.vat_applicable && !profile.tva_intracom)
    missing.push({ code: "tva_intracom", message: "Numéro de TVA intracommunautaire manquant", section: "vat" });

  if (insurance?.decennial_required) {
    if (!insurance.insurer_name) missing.push({ code: "insurer", message: "Nom de l'assureur décennale manquant", section: "insurance" });
    if (!insurance.policy_number) missing.push({ code: "policy", message: "Numéro de police d'assurance manquant", section: "insurance" });
  }

  if (!profile.iban) missing.push({ code: "iban", message: "IBAN manquant", section: "payment" });
  if (!profile.payment_terms_default) missing.push({ code: "payment_terms", message: "Délai/conditions de règlement par défaut manquants", section: "payment" });

  return missing;
}

export interface ValidationResult {
  ok: boolean;
  blockers: MissingField[];
  warnings: { code: string; message: string }[];
}

/**
 * Charge profil + assurance + settings depuis Supabase et construit ComplianceProfile.
 */
export async function loadComplianceContext(supabase: any, userId: string): Promise<{
  profile: ComplianceProfile | null;
  insurance: InsuranceProfile | null;
  settings: ComplianceSettings | null;
  rawProfile: Record<string, unknown> | null;
}> {
  const [{ data: rawProfile }, { data: insurance }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("insurance_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("compliance_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const profile: ComplianceProfile | null = rawProfile
    ? {
        legal_form: rawProfile.legal_form ?? null,
        company_name: rawProfile.company_name ?? null,
        trade_name: rawProfile.trade_name ?? null,
        owner_first_name: rawProfile.owner_first_name ?? null,
        owner_last_name: rawProfile.owner_last_name ?? null,
        first_name: rawProfile.first_name ?? null,
        last_name: rawProfile.last_name ?? null,
        capital_amount: rawProfile.capital_amount ?? null,
        rcs_city: rawProfile.rcs_city ?? null,
        siren: rawProfile.siren ?? null,
        siret: rawProfile.siret ?? null,
        tva_intracom: rawProfile.tva_intracom ?? null,
        email: rawProfile.email ?? null,
        phone: rawProfile.phone ?? null,
        address: rawProfile.address ?? null,
        vat_applicable: rawProfile.vat_applicable ?? true,
        vat_exemption_293b: rawProfile.vat_exemption_293b ?? false,
        vat_on_debits: rawProfile.vat_on_debits ?? false,
        iban: rawProfile.iban ?? null,
        bic: rawProfile.bic ?? null,
        accepted_payment_methods: rawProfile.accepted_payment_methods ?? null,
        payment_terms_default: rawProfile.payment_terms_default ?? null,
        late_penalty_rate: rawProfile.late_penalty_rate ?? null,
        fixed_recovery_fee_b2b: rawProfile.fixed_recovery_fee_b2b ?? true,
        onboarding_compliance_completed_at: rawProfile.onboarding_compliance_completed_at ?? null,
      }
    : null;

  return { profile, insurance: insurance ?? null, settings: settings ?? null, rawProfile: rawProfile ?? null };
}
