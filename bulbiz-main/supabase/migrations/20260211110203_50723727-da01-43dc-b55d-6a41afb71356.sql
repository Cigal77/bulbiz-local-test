
-- Add new dossier_status enum values
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'invoice_pending';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'invoice_paid';

-- Migrate existing a_qualifier dossiers to nouveau
UPDATE public.dossiers SET status = 'nouveau' WHERE status = 'a_qualifier';
