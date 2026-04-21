
-- Add client token fields to invoices for public access
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_token text,
  ADD COLUMN IF NOT EXISTS client_token_expires_at timestamptz;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_invoices_client_token ON public.invoices (client_token) WHERE client_token IS NOT NULL;

-- RLS: Public can view invoice by valid token
CREATE POLICY "Public can view invoice by client token"
  ON public.invoices FOR SELECT
  USING (client_token IS NOT NULL AND client_token_expires_at > now());

-- RLS: Public can view invoice lines for token-accessible invoices
CREATE POLICY "Public can view invoice lines by client token"
  ON public.invoice_lines FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM public.invoices
    WHERE client_token IS NOT NULL AND client_token_expires_at > now()
  ));

-- RLS: Public can view artisan profile for invoices with token
CREATE POLICY "Public can view profile for invoice token"
  ON public.profiles FOR SELECT
  USING (user_id IN (
    SELECT user_id FROM public.invoices
    WHERE client_token IS NOT NULL AND client_token_expires_at > now()
  ));
