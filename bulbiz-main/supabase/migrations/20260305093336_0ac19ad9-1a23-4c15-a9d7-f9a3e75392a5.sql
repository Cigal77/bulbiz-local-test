-- Add public_client_slug to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_client_slug text UNIQUE;

-- Add public_link to dossier_source enum
ALTER TYPE public.dossier_source ADD VALUE IF NOT EXISTS 'public_link';

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_profiles_public_client_slug ON public.profiles (public_client_slug) WHERE public_client_slug IS NOT NULL;

-- Allow anon to read profile by slug (for public form page)
CREATE POLICY "Public can view profile by slug"
ON public.profiles
FOR SELECT
TO anon
USING (public_client_slug IS NOT NULL);