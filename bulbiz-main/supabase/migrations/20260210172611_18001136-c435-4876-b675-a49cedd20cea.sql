
-- Add structured address fields to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- Add index on google_place_id for lookups
CREATE INDEX IF NOT EXISTS idx_dossiers_google_place_id ON public.dossiers(google_place_id) WHERE google_place_id IS NOT NULL;
