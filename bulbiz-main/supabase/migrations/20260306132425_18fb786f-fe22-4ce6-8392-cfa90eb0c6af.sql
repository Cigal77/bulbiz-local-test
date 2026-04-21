CREATE TABLE public.ai_summary_cache (
  dossier_id uuid PRIMARY KEY REFERENCES public.dossiers(id) ON DELETE CASCADE,
  summary_json jsonb NOT NULL,
  data_fingerprint text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_summary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache"
  ON public.ai_summary_cache FOR SELECT
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

CREATE POLICY "Users can upsert own cache"
  ON public.ai_summary_cache FOR INSERT
  WITH CHECK (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own cache"
  ON public.ai_summary_cache FOR UPDATE
  USING (dossier_id IN (SELECT id FROM public.dossiers WHERE user_id = auth.uid()));