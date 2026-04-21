
-- Add SMS toggle to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT true;
