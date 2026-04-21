
-- Drop and recreate public quote policies to apply to both anon and authenticated
DROP POLICY IF EXISTS "Public can view quote by signature token" ON public.quotes;
DROP POLICY IF EXISTS "Public can validate quote by signature token" ON public.quotes;
DROP POLICY IF EXISTS "Public can view dossier linked to signed quote" ON public.dossiers;
DROP POLICY IF EXISTS "Public can view artisan profile for signed quote" ON public.profiles;
DROP POLICY IF EXISTS "Public can insert historique for quote validation" ON public.historique;

-- Recreate for both anon and authenticated
CREATE POLICY "Public can view quote by signature token"
  ON public.quotes FOR SELECT TO anon, authenticated
  USING (signature_token IS NOT NULL);

CREATE POLICY "Public can validate quote by signature token"
  ON public.quotes FOR UPDATE TO anon, authenticated
  USING (signature_token IS NOT NULL)
  WITH CHECK (signature_token IS NOT NULL);

CREATE POLICY "Public can view dossier linked to signed quote"
  ON public.dossiers FOR SELECT TO anon, authenticated
  USING (id IN (SELECT dossier_id FROM public.quotes WHERE signature_token IS NOT NULL));

CREATE POLICY "Public can view artisan profile for signed quote"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (user_id IN (SELECT user_id FROM public.quotes WHERE signature_token IS NOT NULL));

CREATE POLICY "Public can insert historique for quote validation"
  ON public.historique FOR INSERT TO anon, authenticated
  WITH CHECK (dossier_id IN (SELECT dossier_id FROM public.quotes WHERE signature_token IS NOT NULL));
