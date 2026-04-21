-- 1. Étendre catalog_material
ALTER TABLE public.catalog_material
  ADD COLUMN IF NOT EXISTS secondary_sector_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS normalized_name text;

CREATE INDEX IF NOT EXISTS idx_catalog_material_secondary_sectors
  ON public.catalog_material USING GIN (secondary_sector_ids);

CREATE INDEX IF NOT EXISTS idx_catalog_material_tags
  ON public.catalog_material USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_catalog_material_sector
  ON public.catalog_material (sector_id) WHERE sector_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_material_category
  ON public.catalog_material (category_id) WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_material_normalized_name
  ON public.catalog_material (normalized_name);

-- 2. Table d'audit de classification
CREATE TABLE IF NOT EXISTS public.product_classification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  old_sector_id uuid,
  old_category_id uuid,
  old_category_path text,
  suggested_primary_sector_id uuid,
  suggested_secondary_sector_ids uuid[] DEFAULT '{}',
  suggested_category_id uuid,
  suggested_subcategory text,
  suggested_tags text[] DEFAULT '{}',
  suggested_synonyms text[] DEFAULT '{}',
  confidence numeric,
  reasoning text,
  review_status text NOT NULL DEFAULT 'applied',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_classification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view classification audit"
  ON public.product_classification_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage classification audit"
  ON public.product_classification_audit
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_classification_audit_material
  ON public.product_classification_audit (material_id);

CREATE INDEX IF NOT EXISTS idx_classification_audit_created
  ON public.product_classification_audit (created_at DESC);