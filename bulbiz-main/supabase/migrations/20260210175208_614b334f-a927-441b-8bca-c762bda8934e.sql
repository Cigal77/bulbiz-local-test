
-- Add 'done' to appointment_status enum
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'done';

-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid');

-- Create client type enum
CREATE TYPE public.client_type AS ENUM ('individual', 'business');

-- Create vat mode enum
CREATE TYPE public.vat_mode AS ENUM ('normal', 'no_vat_293b');

-- Create invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invoice_number text NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  service_date date,
  client_first_name text,
  client_last_name text,
  client_email text,
  client_phone text,
  client_address text,
  client_company text,
  artisan_name text,
  artisan_company text,
  artisan_address text,
  artisan_phone text,
  artisan_email text,
  artisan_siret text,
  artisan_tva_intracom text,
  vat_mode public.vat_mode NOT NULL DEFAULT 'normal',
  client_type public.client_type NOT NULL DEFAULT 'individual',
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  payment_terms text,
  late_fees_text text DEFAULT 'Pénalités de retard : 3 fois le taux d''intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €.',
  notes text,
  pdf_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_number, user_id)
);

-- Create invoice_lines table
CREATE TABLE public.invoice_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  qty numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'u',
  unit_price numeric NOT NULL DEFAULT 0,
  tva_rate numeric NOT NULL DEFAULT 10,
  discount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft invoices"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- RLS policies for invoice_lines
CREATE POLICY "Users can view own invoice lines"
  ON public.invoice_lines FOR SELECT
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own invoice lines"
  ON public.invoice_lines FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own invoice lines"
  ON public.invoice_lines FOR UPDATE
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own invoice lines"
  ON public.invoice_lines FOR DELETE
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

-- Invoice number generation function
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  count_invoices integer;
  year_str text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count_invoices
  FROM public.invoices
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('year', now());
  RETURN 'FAC-' || year_str || '-' || lpad(count_invoices::text, 4, '0');
END;
$$;

-- Add profile fields for invoicing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tva_intracom text,
  ADD COLUMN IF NOT EXISTS vat_applicable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_terms_default text DEFAULT 'Paiement à réception de facture. Chèque, virement ou espèces.';

-- Trigger for updated_at on invoices
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on invoice_lines
CREATE TRIGGER update_invoice_lines_updated_at
  BEFORE UPDATE ON public.invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
