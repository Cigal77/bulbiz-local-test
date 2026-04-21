
-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.legal_form AS ENUM ('ei', 'micro', 'eurl', 'sarl', 'sasu', 'sas', 'autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_doc_type AS ENUM ('standalone', 'final', 'deposit', 'credit_note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.operation_category AS ENUM ('sale', 'service', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new enum values to existing enums
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'annule';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'expire';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'canceled';

-- ============================================
-- EXTEND profiles
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_form public.legal_form,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS owner_first_name text,
  ADD COLUMN IF NOT EXISTS owner_last_name text,
  ADD COLUMN IF NOT EXISTS capital_amount numeric,
  ADD COLUMN IF NOT EXISTS rcs_city text,
  ADD COLUMN IF NOT EXISTS siren text,
  ADD COLUMN IF NOT EXISTS vat_exemption_293b boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_on_debits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bic text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS accepted_payment_methods text[] DEFAULT ARRAY['virement','cheque']::text[],
  ADD COLUMN IF NOT EXISTS default_deposit_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS default_deposit_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_penalty_rate numeric DEFAULT 10.49,
  ADD COLUMN IF NOT EXISTS fixed_recovery_fee_b2b boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS early_payment_discount_text text,
  ADD COLUMN IF NOT EXISTS onboarding_compliance_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS compliance_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0ea5e9',
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS favorite_vat_rates numeric[] DEFAULT ARRAY[20, 10, 5.5]::numeric[];

-- ============================================
-- NEW TABLE: insurance_profiles
-- ============================================

CREATE TABLE IF NOT EXISTS public.insurance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  decennial_required boolean NOT NULL DEFAULT false,
  insurer_name text,
  policy_number text,
  insurer_contact text,
  geographic_coverage text DEFAULT 'France métropolitaine',
  validity_start date,
  validity_end date,
  default_legal_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insurance" ON public.insurance_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insurance" ON public.insurance_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insurance" ON public.insurance_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own insurance" ON public.insurance_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_insurance_profiles_updated_at
  BEFORE UPDATE ON public.insurance_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- NEW TABLE: compliance_settings
-- ============================================

CREATE TABLE IF NOT EXISTS public.compliance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  waste_management_text text DEFAULT 'Évacuation et traitement des déchets de chantier inclus conformément à la réglementation en vigueur.',
  default_quote_validity_days integer NOT NULL DEFAULT 30,
  block_generation_if_incomplete boolean NOT NULL DEFAULT true,
  auto_add_ei_mention boolean NOT NULL DEFAULT true,
  auto_add_293b_mention boolean NOT NULL DEFAULT true,
  auto_add_decennial_notice boolean NOT NULL DEFAULT true,
  auto_add_40eur_b2b boolean NOT NULL DEFAULT true,
  auto_add_waste_mention boolean NOT NULL DEFAULT false,
  archive_locked_documents boolean NOT NULL DEFAULT true,
  audit_log_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own compliance settings" ON public.compliance_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own compliance settings" ON public.compliance_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own compliance settings" ON public.compliance_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own compliance settings" ON public.compliance_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_compliance_settings_updated_at
  BEFORE UPDATE ON public.compliance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- EXTEND quotes
-- ============================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid,
  ADD COLUMN IF NOT EXISTS legal_mentions_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS compliance_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS deposit_type text,
  ADD COLUMN IF NOT EXISTS deposit_value numeric,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- ============================================
-- EXTEND invoices
-- ============================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type public.invoice_doc_type NOT NULL DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS related_quote_id uuid,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS legal_mentions_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS compliance_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS customer_siren text,
  ADD COLUMN IF NOT EXISTS operation_category public.operation_category DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS worksite_address text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS late_penalty_rate numeric,
  ADD COLUMN IF NOT EXISTS recovery_fee_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;

-- ============================================
-- RPC: generate_credit_note_number
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_credit_note_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  count_docs integer;
  year_str text;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count_docs
  FROM public.invoices
  WHERE user_id = p_user_id
    AND invoice_type = 'credit_note'
    AND created_at >= date_trunc('year', now());
  RETURN 'AV-' || year_str || '-' || lpad(count_docs::text, 4, '0');
END;
$function$;

-- ============================================
-- RPC: generate_deposit_invoice_number
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_deposit_invoice_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  count_docs integer;
  year_str text;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count_docs
  FROM public.invoices
  WHERE user_id = p_user_id
    AND invoice_type = 'deposit'
    AND created_at >= date_trunc('year', now());
  RETURN 'ACO-' || year_str || '-' || lpad(count_docs::text, 4, '0');
END;
$function$;

-- ============================================
-- TRIGGER: quote immutability after sent/signed
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_quote_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Si statut envoyé/signé et version inchangée, bloquer modif des champs financiers/numéro
  IF OLD.status IN ('envoye', 'signe') AND NEW.version_number = OLD.version_number THEN
    IF NEW.quote_number != OLD.quote_number
       OR NEW.total_ht != OLD.total_ht
       OR NEW.total_ttc != OLD.total_ttc
       OR NEW.items::text != OLD.items::text THEN
      -- Autoriser uniquement transitions de statut autorisées
      IF NEW.status NOT IN ('signe', 'refuse', 'annule', 'expire') THEN
        RAISE EXCEPTION 'Devis verrouillé: créez une nouvelle version pour modifier les montants ou lignes.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_quote_immutability ON public.quotes;
CREATE TRIGGER trg_enforce_quote_immutability
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_immutability();

-- ============================================
-- TRIGGER: invoice immutability after sent
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Bloquer modif d'une facture non-draft sauf transitions de statut/paiement
  IF OLD.status != 'draft' THEN
    IF NEW.invoice_number != OLD.invoice_number
       OR NEW.total_ht != OLD.total_ht
       OR NEW.total_ttc != OLD.total_ttc THEN
      RAISE EXCEPTION 'Facture verrouillée: une facture émise ne peut être modifiée. Émettez un avoir si nécessaire.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_immutability ON public.invoices;
CREATE TRIGGER trg_enforce_invoice_immutability
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_immutability();

-- ============================================
-- TRIGGER: prevent delete of sent invoices/quotes
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_delete_emitted_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status != 'draft' THEN
    RAISE EXCEPTION 'Facture émise: suppression interdite. Annulez-la (statut canceled) ou émettez un avoir.';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_delete_invoice ON public.invoices;
CREATE TRIGGER trg_prevent_delete_invoice
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_emitted_invoice();

CREATE OR REPLACE FUNCTION public.prevent_delete_emitted_quote()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IN ('envoye', 'signe') THEN
    RAISE EXCEPTION 'Devis envoyé/signé: suppression interdite. Annulez-le (statut annule).';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_delete_quote ON public.quotes;
CREATE TRIGGER trg_prevent_delete_quote
  BEFORE DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_emitted_quote();

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_quotes_parent ON public.quotes(parent_quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_parent ON public.invoices(parent_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_related_quote ON public.invoices(related_quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(invoice_type);
