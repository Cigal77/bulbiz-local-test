
-- 1. Table email_log : observabilité centralisée
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dossier_id uuid,
  document_type text,
  document_id uuid,
  template text NOT NULL,
  recipient text,
  provider text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user_created ON public.email_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_dossier ON public.email_log(dossier_id);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own email logs" ON public.email_log;
CREATE POLICY "Users see their own email logs"
  ON public.email_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role insère (les edge functions utilisent la service key, pas besoin de policy INSERT)

-- 2. Extensions cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Stocker la service role key dans le vault (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret(
      current_setting('request.jwt.claim.role', true), -- placeholder; sera remplacé manuellement
      'service_role_key',
      'Service role key for cron jobs'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- vault.create_secret peut échouer selon les permissions ; on continue
  NULL;
END $$;

-- 4. Planifier check-relances 3 fois par jour (8h, 13h, 17h UTC ≈ 9h/14h/18h Europe/Paris hiver)
DO $$
DECLARE
  job_id integer;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'check-relances-daily';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'check-relances-daily',
  '0 8,13,17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://egmhythtnroyyiicuikv.supabase.co/functions/v1/check-relances',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
