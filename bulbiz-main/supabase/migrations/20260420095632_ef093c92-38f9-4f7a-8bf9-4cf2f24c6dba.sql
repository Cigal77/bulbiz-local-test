
-- 1. Étendre catalog_material
ALTER TABLE public.catalog_material
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS supplier_ref text,
  ADD COLUMN IF NOT EXISTS internal_code text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_price numeric,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_catalog_material_user_favorite ON public.catalog_material(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_catalog_material_usage ON public.catalog_material(user_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_material_last_used ON public.catalog_material(user_id, last_used_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_catalog_material_import_batch ON public.catalog_material(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_material_internal_code ON public.catalog_material(user_id, internal_code) WHERE internal_code IS NOT NULL;

-- 2. Table catalog_import_jobs
CREATE TABLE IF NOT EXISTS public.catalog_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  filename text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  mapping jsonb DEFAULT '{}'::jsonb,
  dedup_strategy text NOT NULL DEFAULT 'skip',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.catalog_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import jobs"
  ON public.catalog_import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import jobs"
  ON public.catalog_import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import jobs"
  ON public.catalog_import_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own import jobs"
  ON public.catalog_import_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Table catalog_usage_log
CREATE TABLE IF NOT EXISTS public.catalog_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid,
  quote_id uuid,
  label text NOT NULL,
  unit text,
  unit_price numeric,
  vat_rate numeric,
  qty numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_usage_log_user_label ON public.catalog_usage_log(user_id, label);
CREATE INDEX IF NOT EXISTS idx_catalog_usage_log_user_created ON public.catalog_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_usage_log_material ON public.catalog_usage_log(material_id) WHERE material_id IS NOT NULL;

ALTER TABLE public.catalog_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage log"
  ON public.catalog_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage log"
  ON public.catalog_usage_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Trigger: log usage automatically when a quote_line is inserted
CREATE OR REPLACE FUNCTION public.log_quote_line_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_material_id uuid;
BEGIN
  -- Récupérer le user_id du quote
  SELECT user_id INTO v_user_id FROM public.quotes WHERE id = NEW.quote_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tenter de retrouver le material correspondant si la source est CATALOG
  IF NEW.source = 'CATALOG' AND NEW.source_ref_id IS NOT NULL THEN
    BEGIN
      v_material_id := NEW.source_ref_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_material_id := NULL;
    END;
  END IF;

  -- Logger l'usage
  INSERT INTO public.catalog_usage_log (user_id, material_id, quote_id, label, unit, unit_price, vat_rate, qty)
  VALUES (v_user_id, v_material_id, NEW.quote_id, NEW.label, NEW.unit, NEW.unit_price, NEW.tva_rate, NEW.qty);

  -- Si match catalogue, incrémenter le compteur
  IF v_material_id IS NOT NULL THEN
    UPDATE public.catalog_material
    SET usage_count = usage_count + 1,
        last_used_at = now(),
        last_used_price = NEW.unit_price
    WHERE id = v_material_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_quote_line_usage ON public.quote_lines;
CREATE TRIGGER trg_log_quote_line_usage
  AFTER INSERT ON public.quote_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.log_quote_line_usage();
