
-- Activer l'extension trigram en premier
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. SECTEURS BTP
CREATE TABLE IF NOT EXISTS public.product_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read sectors"
  ON public.product_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sectors"
  ON public.product_sectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. CATEGORIES PRODUIT
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.product_sectors(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, slug, parent_id)
);
CREATE INDEX IF NOT EXISTS idx_product_categories_sector ON public.product_categories(sector_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON public.product_categories(parent_id);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read categories"
  ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories"
  ON public.product_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. SOURCES DE DONNEES
CREATE TABLE IF NOT EXISTS public.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('website','pdf','csv','manual','supplier_feed','firecrawl')),
  base_url text,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','error')),
  config jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage data sources"
  ON public.data_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. JOBS D'INGESTION
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid REFERENCES public.data_sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','partial')),
  started_at timestamptz,
  finished_at timestamptz,
  items_found integer DEFAULT 0,
  items_created integer DEFAULT 0,
  items_updated integer DEFAULT 0,
  items_flagged integer DEFAULT 0,
  errors_json jsonb DEFAULT '[]'::jsonb,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ingestion jobs"
  ON public.ingestion_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. ENRICHIR catalog_material
ALTER TABLE public.catalog_material
  ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES public.product_sectors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_external_id text,
  ADD COLUMN IF NOT EXISTS raw_name text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_catalog_material_sector ON public.catalog_material(sector_id);
CREATE INDEX IF NOT EXISTS idx_catalog_material_category ON public.catalog_material(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_material_label_trgm ON public.catalog_material USING gin (label gin_trgm_ops);

-- 6. INTERVENTION TYPES
CREATE TABLE IF NOT EXISTS public.intervention_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sector_id uuid REFERENCES public.product_sectors(id) ON DELETE SET NULL,
  synonyms text[] DEFAULT '{}',
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intervention_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read intervention types"
  ON public.intervention_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage intervention types"
  ON public.intervention_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. PACK INTERVENTION → PRODUITS
CREATE TABLE IF NOT EXISTS public.intervention_product_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_type_id uuid NOT NULL REFERENCES public.intervention_types(id) ON DELETE CASCADE,
  required_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  often_added_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  labor_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  travel_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  waste_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualification_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intervention_product_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read packs"
  ON public.intervention_product_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage packs"
  ON public.intervention_product_packs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. ASSOCIATIONS PRODUIT ↔ PRODUIT
CREATE TABLE IF NOT EXISTS public.product_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id uuid NOT NULL REFERENCES public.catalog_material(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.catalog_material(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('required_with','often_added_with','optional_with','consumable_for','labor_for','travel_for','alternative_to')),
  intervention_type_id uuid REFERENCES public.intervention_types(id) ON DELETE SET NULL,
  relevance_score numeric NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_product_id, related_product_id, relation_type, intervention_type_id)
);
CREATE INDEX IF NOT EXISTS idx_product_assoc_parent ON public.product_associations(parent_product_id);
ALTER TABLE public.product_associations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read associations"
  ON public.product_associations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage associations"
  ON public.product_associations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9. APPRENTISSAGE USAGE UTILISATEUR
CREATE TABLE IF NOT EXISTS public.user_product_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.catalog_material(id) ON DELETE CASCADE,
  intervention_type_id uuid REFERENCES public.intervention_types(id) ON DELETE SET NULL,
  behavior_type text NOT NULL CHECK (behavior_type IN ('accepted','ignored','edited','favorited','repriced','hidden')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_product_usage_user ON public.user_product_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_usage_product ON public.user_product_usage(product_id);
ALTER TABLE public.user_product_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own usage"
  ON public.user_product_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own usage"
  ON public.user_product_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 10. KITS PERSONNELS
CREATE TABLE IF NOT EXISTS public.user_intervention_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intervention_type_id uuid REFERENCES public.intervention_types(id) ON DELETE SET NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_intervention_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own kits"
  ON public.user_intervention_kits FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. Triggers updated_at
CREATE TRIGGER trg_data_sources_updated_at BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_intervention_packs_updated_at BEFORE UPDATE ON public.intervention_product_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_user_kits_updated_at BEFORE UPDATE ON public.user_intervention_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_catalog_material_updated_at BEFORE UPDATE ON public.catalog_material
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
