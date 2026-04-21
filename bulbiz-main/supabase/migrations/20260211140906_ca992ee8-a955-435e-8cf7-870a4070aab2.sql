
-- Add new dossier_status enum values
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'devis_signe';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'en_attente_rdv';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'rdv_pris';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'rdv_termine';
