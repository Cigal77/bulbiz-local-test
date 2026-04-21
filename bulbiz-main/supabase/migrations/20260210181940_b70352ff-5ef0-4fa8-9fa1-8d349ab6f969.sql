
-- Bundle templates table
CREATE TABLE public.bundle_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_name TEXT NOT NULL,
  description TEXT,
  trigger_category TEXT NOT NULL,
  trigger_keywords TEXT[] DEFAULT '{}',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_id UUID, -- NULL = global Bulbiz template
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bundle_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read global + own bundles"
  ON public.bundle_templates FOR SELECT
  USING ((user_id IS NULL) OR (user_id = auth.uid()));

CREATE POLICY "Users can insert own bundles"
  ON public.bundle_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bundles"
  ON public.bundle_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bundles"
  ON public.bundle_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Bundle template items (lines composing a bundle)
CREATE TABLE public.bundle_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.bundle_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  item_type TEXT NOT NULL DEFAULT 'standard', -- main_oeuvre, materiel, fourniture, deplacement, standard
  unit TEXT NOT NULL DEFAULT 'u',
  default_qty NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 10,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  catalog_item_id UUID REFERENCES public.catalog_material(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bundle_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bundle items"
  ON public.bundle_template_items FOR SELECT
  USING (
    bundle_id IN (SELECT id FROM public.bundle_templates WHERE (user_id IS NULL) OR (user_id = auth.uid()))
  );

CREATE POLICY "Users can insert own bundle items"
  ON public.bundle_template_items FOR INSERT
  WITH CHECK (
    bundle_id IN (SELECT id FROM public.bundle_templates WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own bundle items"
  ON public.bundle_template_items FOR UPDATE
  USING (
    bundle_id IN (SELECT id FROM public.bundle_templates WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own bundle items"
  ON public.bundle_template_items FOR DELETE
  USING (
    bundle_id IN (SELECT id FROM public.bundle_templates WHERE user_id = auth.uid())
  );

-- Artisan catalog override
CREATE TABLE public.artisan_catalog_override (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.catalog_material(id) ON DELETE CASCADE,
  custom_price_ht NUMERIC,
  custom_label TEXT,
  margin_percent NUMERIC,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.artisan_catalog_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own overrides"
  ON public.artisan_catalog_override FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own overrides"
  ON public.artisan_catalog_override FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own overrides"
  ON public.artisan_catalog_override FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own overrides"
  ON public.artisan_catalog_override FOR DELETE
  USING (auth.uid() = user_id);

-- Add synonyms column to catalog_material for better search
ALTER TABLE public.catalog_material ADD COLUMN IF NOT EXISTS synonyms TEXT[] DEFAULT '{}';
