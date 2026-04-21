
-- Add auto-send client link settings to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_send_client_link boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS client_link_validity_days integer NOT NULL DEFAULT 7;
