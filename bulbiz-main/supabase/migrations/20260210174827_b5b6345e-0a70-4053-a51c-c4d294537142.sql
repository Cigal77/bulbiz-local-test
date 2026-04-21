
-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM (
  'none',
  'rdv_pending',
  'slots_proposed',
  'client_selected',
  'rdv_confirmed',
  'cancelled'
);

-- Create appointment source enum
CREATE TYPE public.appointment_source AS ENUM (
  'client_selected',
  'manual',
  'phone',
  'email'
);

-- Add appointment fields to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN appointment_status public.appointment_status NOT NULL DEFAULT 'none',
  ADD COLUMN appointment_date date,
  ADD COLUMN appointment_time_start time,
  ADD COLUMN appointment_time_end time,
  ADD COLUMN appointment_source public.appointment_source,
  ADD COLUMN appointment_notes text,
  ADD COLUMN appointment_confirmed_at timestamptz;

-- Create appointment_slots table
CREATE TABLE public.appointment_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  time_start time NOT NULL,
  time_end time NOT NULL,
  selected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on appointment_slots
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;

-- RLS: Users can manage slots for their own dossiers
CREATE POLICY "Users can view own appointment slots"
  ON public.appointment_slots FOR SELECT
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own appointment slots"
  ON public.appointment_slots FOR INSERT
  WITH CHECK (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own appointment slots"
  ON public.appointment_slots FOR UPDATE
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own appointment slots"
  ON public.appointment_slots FOR DELETE
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

-- Public access for client slot selection (via dossier with active client token)
CREATE POLICY "Public can view slots for token-linked dossiers"
  ON public.appointment_slots FOR SELECT
  USING (dossier_id IN (
    SELECT id FROM public.dossiers
    WHERE client_token IS NOT NULL
      AND client_token_expires_at > now()
  ));

CREATE POLICY "Public can select slot for token-linked dossiers"
  ON public.appointment_slots FOR UPDATE
  USING (dossier_id IN (
    SELECT id FROM public.dossiers
    WHERE client_token IS NOT NULL
      AND client_token_expires_at > now()
  ));
