
-- Create notification_logs table for technical tracking
CREATE TABLE public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- APPOINTMENT_REQUESTED, SLOTS_PROPOSED, APPOINTMENT_CONFIRMED
  channel text NOT NULL, -- email, sms
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- SENT, FAILED, SKIPPED
  error_code text,
  error_message text,
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Only artisan can see their own notification logs
CREATE POLICY "Users can view own notification logs"
  ON public.notification_logs FOR SELECT
  USING (dossier_id IN (
    SELECT id FROM public.dossiers WHERE user_id = auth.uid()
  ));

-- Edge functions insert via service role, so no INSERT policy needed for users
-- But allow insert for historique-like usage
CREATE POLICY "Users can insert own notification logs"
  ON public.notification_logs FOR INSERT
  WITH CHECK (dossier_id IN (
    SELECT id FROM public.dossiers WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_notification_logs_dossier ON public.notification_logs(dossier_id);
CREATE INDEX idx_notification_logs_event ON public.notification_logs(event_type);
