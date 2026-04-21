ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS relance_delay_facture_1 integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS relance_delay_facture_2 integer NOT NULL DEFAULT 7;