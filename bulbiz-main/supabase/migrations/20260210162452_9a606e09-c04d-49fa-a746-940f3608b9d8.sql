
-- Add signature/validation columns to quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS signature_token text,
  ADD COLUMN IF NOT EXISTS signature_token_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS accepted_ip text,
  ADD COLUMN IF NOT EXISTS accepted_user_agent text,
  ADD COLUMN IF NOT EXISTS refused_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS refused_reason text;

-- Create index on signature_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_quotes_signature_token ON public.quotes (signature_token) WHERE signature_token IS NOT NULL;

-- Allow public (anon) read of quote by signature_token for the public validation page
CREATE POLICY "Public can view quote by signature token"
  ON public.quotes
  FOR SELECT
  TO anon
  USING (signature_token IS NOT NULL);

-- Allow anon to update quote via signature token (only specific fields)
CREATE POLICY "Public can validate quote by signature token"
  ON public.quotes
  FOR UPDATE
  TO anon
  USING (signature_token IS NOT NULL)
  WITH CHECK (signature_token IS NOT NULL);

-- Allow anon to read dossier linked to a quote with signature token (for displaying client info)
CREATE POLICY "Public can view dossier linked to signed quote"
  ON public.dossiers
  FOR SELECT
  TO anon
  USING (
    id IN (SELECT dossier_id FROM public.quotes WHERE signature_token IS NOT NULL)
  );

-- Allow anon to read profile of artisan linked to a quote
CREATE POLICY "Public can view artisan profile for signed quote"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (
    user_id IN (SELECT user_id FROM public.quotes WHERE signature_token IS NOT NULL)
  );

-- Allow anon to insert historique for quote validation
CREATE POLICY "Public can insert historique for quote validation"
  ON public.historique
  FOR INSERT
  TO anon
  WITH CHECK (
    dossier_id IN (SELECT dossier_id FROM public.quotes WHERE signature_token IS NOT NULL)
  );
