
-- Make dossier fields nullable for progressive filling
ALTER TABLE public.dossiers ALTER COLUMN client_first_name DROP NOT NULL;
ALTER TABLE public.dossiers ALTER COLUMN client_last_name DROP NOT NULL;
ALTER TABLE public.dossiers ALTER COLUMN client_phone DROP NOT NULL;
ALTER TABLE public.dossiers ALTER COLUMN address DROP NOT NULL;

-- Set defaults so inserts without these fields work
ALTER TABLE public.dossiers ALTER COLUMN client_first_name SET DEFAULT NULL;
ALTER TABLE public.dossiers ALTER COLUMN client_last_name SET DEFAULT NULL;
ALTER TABLE public.dossiers ALTER COLUMN client_phone SET DEFAULT NULL;
ALTER TABLE public.dossiers ALTER COLUMN address SET DEFAULT NULL;
