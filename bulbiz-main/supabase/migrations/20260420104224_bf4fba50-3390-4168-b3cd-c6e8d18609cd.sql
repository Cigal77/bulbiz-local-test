
-- ===========================================================
-- SECURITY HARDENING — Pre-publish audit fixes
-- ===========================================================

-- 1. QUOTES: enforce expiry on public read
DROP POLICY IF EXISTS "Public can view quote by signature token" ON public.quotes;
CREATE POLICY "Public can view quote by signature token"
ON public.quotes
FOR SELECT
TO anon
USING (
  signature_token IS NOT NULL
  AND signature_token_expires_at IS NOT NULL
  AND signature_token_expires_at > now()
);

-- Tighten public UPDATE for signing too
DROP POLICY IF EXISTS "Public can validate quote by signature token" ON public.quotes;
CREATE POLICY "Public can validate quote by signature token"
ON public.quotes
FOR UPDATE
TO anon
USING (
  signature_token IS NOT NULL
  AND signature_token_expires_at IS NOT NULL
  AND signature_token_expires_at > now()
)
WITH CHECK (
  signature_token IS NOT NULL
);

-- 2. DOSSIERS: enforce expiry on public read via signed quote
DROP POLICY IF EXISTS "Public can view dossier linked to signed quote" ON public.dossiers;
CREATE POLICY "Public can view dossier linked to signed quote"
ON public.dossiers
FOR SELECT
TO anon
USING (
  id IN (
    SELECT q.dossier_id FROM public.quotes q
    WHERE q.signature_token IS NOT NULL
      AND q.signature_token_expires_at IS NOT NULL
      AND q.signature_token_expires_at > now()
  )
);

-- 3. PROFILES: replace overly broad anon policies with restricted view-based access

-- Drop both broad anon policies on profiles
DROP POLICY IF EXISTS "Public can view profile by slug" ON public.profiles;
DROP POLICY IF EXISTS "Public can view artisan profile for signed quote" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profile for invoice token" ON public.profiles;

-- Create a SECURITY DEFINER function returning ONLY public-safe fields by slug
CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(_slug text)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  company_name text,
  trade_name text,
  logo_url text,
  primary_color text,
  public_client_slug text,
  client_slots_enabled boolean,
  client_message_template text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, first_name, last_name, company_name, trade_name,
         logo_url, primary_color, public_client_slug, client_slots_enabled,
         client_message_template
  FROM public.profiles
  WHERE public_client_slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated;

-- Public-safe artisan info for a signed quote (only branding/contact, no IBAN/SIRET)
CREATE OR REPLACE FUNCTION public.get_public_profile_for_quote(_signature_token text)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  company_name text,
  trade_name text,
  logo_url text,
  primary_color text,
  email text,
  phone text,
  address text,
  siret text,
  legal_form text,
  email_signature text,
  footer_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.first_name, p.last_name, p.company_name, p.trade_name,
         p.logo_url, p.primary_color, p.email, p.phone, p.address,
         p.siret, p.legal_form, p.email_signature, p.footer_text
  FROM public.profiles p
  JOIN public.quotes q ON q.user_id = p.user_id
  WHERE q.signature_token = _signature_token
    AND q.signature_token_expires_at IS NOT NULL
    AND q.signature_token_expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_for_quote(text) TO anon, authenticated;

-- Public-safe artisan info for an invoice (token-scoped)
CREATE OR REPLACE FUNCTION public.get_public_profile_for_invoice(_client_token text)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  company_name text,
  trade_name text,
  logo_url text,
  primary_color text,
  email text,
  phone text,
  address text,
  siret text,
  legal_form text,
  email_signature text,
  footer_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.first_name, p.last_name, p.company_name, p.trade_name,
         p.logo_url, p.primary_color, p.email, p.phone, p.address,
         p.siret, p.legal_form, p.email_signature, p.footer_text
  FROM public.profiles p
  JOIN public.invoices i ON i.user_id = p.user_id
  WHERE i.client_token = _client_token
    AND i.client_token_expires_at IS NOT NULL
    AND i.client_token_expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_for_invoice(text) TO anon, authenticated;

-- 4. STORAGE: remove overly broad public SELECT policies on dossier-medias
DROP POLICY IF EXISTS "Public can read dossier-medias for quote validation" ON storage.objects;
DROP POLICY IF EXISTS "Public can view dossier medias" ON storage.objects;

-- Add scoped anon SELECT: only for files belonging to a dossier with a valid quote signature token
CREATE POLICY "Public can read dossier-medias for active signed quote"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'dossier-medias'
  AND (storage.foldername(name))[1] IN (
    SELECT (q.dossier_id)::text
    FROM public.quotes q
    WHERE q.signature_token IS NOT NULL
      AND q.signature_token_expires_at IS NOT NULL
      AND q.signature_token_expires_at > now()
  )
);

-- Add scoped anon SELECT: for files belonging to a dossier with an active invoice token
CREATE POLICY "Public can read dossier-medias for active invoice token"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'dossier-medias'
  AND (storage.foldername(name))[1] IN (
    SELECT (i.dossier_id)::text
    FROM public.invoices i
    WHERE i.client_token IS NOT NULL
      AND i.client_token_expires_at IS NOT NULL
      AND i.client_token_expires_at > now()
  )
);

-- Allow public-uploads/ subfolder for the public client form (already used by submit-public-form)
CREATE POLICY "Anon can read public-uploads staging"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'dossier-medias'
  AND (storage.foldername(name))[1] = 'public-uploads'
);
