
-- ==========================================
-- 1) quote_lines — source de vérité du devis
-- ==========================================
CREATE TABLE public.quote_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_type text NOT NULL DEFAULT 'OTHER' CHECK (line_type IN ('LABOUR','MATERIAL_BIG','MATERIAL_SMALL','CONSUMABLE','TRAVEL','OTHER')),
  label text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'u',
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tva_rate numeric NOT NULL DEFAULT 10,
  discount numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','PROBLEM_TREE','MATERIAL_TREE','SUGGESTED')),
  source_ref_id text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quote lines"
  ON public.quote_lines FOR SELECT
  USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own quote lines"
  ON public.quote_lines FOR INSERT
  WITH CHECK (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own quote lines"
  ON public.quote_lines FOR UPDATE
  USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own quote lines"
  ON public.quote_lines FOR DELETE
  USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE INDEX idx_quote_lines_quote_id ON public.quote_lines(quote_id);

-- ==========================================
-- 2) quote_context — contexte pour suggestions
-- ==========================================
CREATE TABLE public.quote_context (
  quote_id uuid NOT NULL PRIMARY KEY REFERENCES public.quotes(id) ON DELETE CASCADE,
  network_type text DEFAULT 'inconnu',
  wc_type text DEFAULT 'inconnu',
  evacuation_type text DEFAULT 'inconnu',
  access text DEFAULT 'normal',
  urgency boolean DEFAULT false,
  include_travel boolean DEFAULT true,
  include_tests boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quote context"
  ON public.quote_context FOR SELECT
  USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own quote context"
  ON public.quote_context FOR INSERT
  WITH CHECK (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own quote context"
  ON public.quote_context FOR UPDATE
  USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

-- ==========================================
-- 3) quote_labour_summary — résumé persistant
-- ==========================================
CREATE TABLE public.quote_labour_summary (
  quote_id uuid NOT NULL PRIMARY KEY REFERENCES public.quotes(id) ON DELETE CASCADE,
  summary_text text NOT NULL DEFAULT '',
  variant text NOT NULL DEFAULT 'STANDARD' CHECK (variant IN ('SHORT','STANDARD','REASSURING')),
  is_locked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_labour_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own labour summary"
  ON public.quote_labour_summary FOR SELECT
  USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own labour summary"
  ON public.quote_labour_summary FOR INSERT
  WITH CHECK (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own labour summary"
  ON public.quote_labour_summary FOR UPDATE
  USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

-- ==========================================
-- 4) Add slug column to catalog_material for CSV import mapping
-- ==========================================
ALTER TABLE public.catalog_material ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_material_slug ON public.catalog_material(slug) WHERE slug IS NOT NULL;

-- Trigger for updated_at on quote_lines
CREATE TRIGGER update_quote_lines_updated_at
  BEFORE UPDATE ON public.quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
