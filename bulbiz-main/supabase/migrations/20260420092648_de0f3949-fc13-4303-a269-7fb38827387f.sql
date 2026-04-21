CREATE TABLE public.ai_quote_suggestions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  line_ref text,
  suggestion_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','modified','rejected')),
  confidence numeric,
  catalog_match_count integer DEFAULT 0,
  ai_fallback_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE INDEX idx_ai_quote_log_user ON public.ai_quote_suggestions_log(user_id);
CREATE INDEX idx_ai_quote_log_dossier ON public.ai_quote_suggestions_log(dossier_id);
CREATE INDEX idx_ai_quote_log_quote ON public.ai_quote_suggestions_log(quote_id);

ALTER TABLE public.ai_quote_suggestions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai suggestions log"
  ON public.ai_quote_suggestions_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai suggestions log"
  ON public.ai_quote_suggestions_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai suggestions log"
  ON public.ai_quote_suggestions_log FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai suggestions log"
  ON public.ai_quote_suggestions_log FOR DELETE
  USING (auth.uid() = user_id);