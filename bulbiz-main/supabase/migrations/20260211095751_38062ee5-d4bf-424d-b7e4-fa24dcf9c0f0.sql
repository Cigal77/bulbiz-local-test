
-- Fix P0 Security: Restrict all "Public" policies to anon role only
-- These policies currently allow authenticated users to see OTHER users' data

-- 1. DOSSIERS: Drop and recreate for anon only
DROP POLICY IF EXISTS "Public can view dossier linked to signed quote" ON public.dossiers;
CREATE POLICY "Public can view dossier linked to signed quote"
ON public.dossiers FOR SELECT TO anon
USING (id IN (SELECT quotes.dossier_id FROM quotes WHERE quotes.signature_token IS NOT NULL));

-- 2. QUOTES: Drop and recreate SELECT + UPDATE for anon only
DROP POLICY IF EXISTS "Public can view quote by signature token" ON public.quotes;
CREATE POLICY "Public can view quote by signature token"
ON public.quotes FOR SELECT TO anon
USING (signature_token IS NOT NULL);

DROP POLICY IF EXISTS "Public can validate quote by signature token" ON public.quotes;
CREATE POLICY "Public can validate quote by signature token"
ON public.quotes FOR UPDATE TO anon
USING (signature_token IS NOT NULL)
WITH CHECK (signature_token IS NOT NULL);

-- 3. PROFILES: Drop and recreate both public policies for anon only
DROP POLICY IF EXISTS "Public can view artisan profile for signed quote" ON public.profiles;
CREATE POLICY "Public can view artisan profile for signed quote"
ON public.profiles FOR SELECT TO anon
USING (user_id IN (SELECT quotes.user_id FROM quotes WHERE quotes.signature_token IS NOT NULL));

DROP POLICY IF EXISTS "Public can view profile for invoice token" ON public.profiles;
CREATE POLICY "Public can view profile for invoice token"
ON public.profiles FOR SELECT TO anon
USING (user_id IN (SELECT invoices.user_id FROM invoices WHERE invoices.client_token IS NOT NULL AND invoices.client_token_expires_at > now()));

-- 4. HISTORIQUE: Drop and recreate insert policy for anon only
DROP POLICY IF EXISTS "Public can insert historique for quote validation" ON public.historique;
CREATE POLICY "Public can insert historique for quote validation"
ON public.historique FOR INSERT TO anon
WITH CHECK (dossier_id IN (SELECT quotes.dossier_id FROM quotes WHERE quotes.signature_token IS NOT NULL));

-- 5. APPOINTMENT_SLOTS: Drop and recreate for anon only
DROP POLICY IF EXISTS "Public can view slots for token-linked dossiers" ON public.appointment_slots;
CREATE POLICY "Public can view slots for token-linked dossiers"
ON public.appointment_slots FOR SELECT TO anon
USING (dossier_id IN (SELECT dossiers.id FROM dossiers WHERE dossiers.client_token IS NOT NULL AND dossiers.client_token_expires_at > now()));

DROP POLICY IF EXISTS "Public can select slot for token-linked dossiers" ON public.appointment_slots;
CREATE POLICY "Public can select slot for token-linked dossiers"
ON public.appointment_slots FOR UPDATE TO anon
USING (dossier_id IN (SELECT dossiers.id FROM dossiers WHERE dossiers.client_token IS NOT NULL AND dossiers.client_token_expires_at > now()));

-- 6. INVOICES: Already uses {public} role, restrict to anon
DROP POLICY IF EXISTS "Public can view invoice by client token" ON public.invoices;
CREATE POLICY "Public can view invoice by client token"
ON public.invoices FOR SELECT TO anon
USING (client_token IS NOT NULL AND client_token_expires_at > now());

-- 7. INVOICE_LINES: Already uses {public} role, restrict to anon
DROP POLICY IF EXISTS "Public can view invoice lines by client token" ON public.invoice_lines;
CREATE POLICY "Public can view invoice lines by client token"
ON public.invoice_lines FOR SELECT TO anon
USING (invoice_id IN (SELECT invoices.id FROM invoices WHERE invoices.client_token IS NOT NULL AND invoices.client_token_expires_at > now()));
