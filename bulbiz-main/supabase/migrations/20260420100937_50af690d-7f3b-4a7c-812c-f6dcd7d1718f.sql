-- Table de préférences de suggestions par utilisateur (masquage)
CREATE TABLE public.user_suggestion_preference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_signature text NOT NULL, -- material_id (uuid) OU label normalisé en minuscule
  intervention_id uuid REFERENCES public.problem_taxonomy(id) ON DELETE CASCADE,
  is_hidden boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_signature, intervention_id)
);

CREATE INDEX idx_user_suggestion_preference_user ON public.user_suggestion_preference(user_id);
CREATE INDEX idx_user_suggestion_preference_lookup ON public.user_suggestion_preference(user_id, intervention_id);

ALTER TABLE public.user_suggestion_preference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestion preferences"
  ON public.user_suggestion_preference FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suggestion preferences"
  ON public.user_suggestion_preference FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestion preferences"
  ON public.user_suggestion_preference FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggestion preferences"
  ON public.user_suggestion_preference FOR DELETE
  USING (auth.uid() = user_id);