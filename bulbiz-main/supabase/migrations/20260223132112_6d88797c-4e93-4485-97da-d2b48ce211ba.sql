
-- Add multi-trade and practical info columns to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS trade_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS problem_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS housing_type text,
  ADD COLUMN IF NOT EXISTS occupant_type text,
  ADD COLUMN IF NOT EXISTS floor_number integer,
  ADD COLUMN IF NOT EXISTS has_elevator boolean,
  ADD COLUMN IF NOT EXISTS access_code text,
  ADD COLUMN IF NOT EXISTS availability text;
