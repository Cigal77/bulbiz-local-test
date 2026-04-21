-- Add artisan business fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS default_vat_rate numeric(5,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS default_validity_days integer DEFAULT 30;

-- Create quote status enum
CREATE TYPE public.quote_status AS ENUM ('brouillon', 'envoye', 'signe', 'refuse');

-- Create quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  quote_number text NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'brouillon',
  -- For imported PDFs
  pdf_url text,
  is_imported boolean NOT NULL DEFAULT false,
  -- For in-app created quotes (Phase 2)
  items jsonb DEFAULT '[]'::jsonb,
  total_ht numeric(10,2) DEFAULT 0,
  total_tva numeric(10,2) DEFAULT 0,
  total_ttc numeric(10,2) DEFAULT 0,
  notes text,
  validity_days integer DEFAULT 30,
  sent_at timestamp with time zone,
  signed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own quotes"
  ON public.quotes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotes"
  ON public.quotes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quotes"
  ON public.quotes FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for quote numbering per user
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_quotes integer;
  year_str text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count_quotes 
  FROM public.quotes 
  WHERE user_id = p_user_id 
    AND created_at >= date_trunc('year', now());
  RETURN 'DEV-' || year_str || '-' || lpad(count_quotes::text, 4, '0');
END;
$$;