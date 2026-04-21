
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'client',
  function_name text,
  error_message text NOT NULL,
  error_stack text,
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert errors (anon visitors + authenticated users)
CREATE POLICY "Anyone can insert error logs"
ON public.error_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read error logs
CREATE POLICY "Admins can view error logs"
ON public.error_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update (mark resolved)
CREATE POLICY "Admins can update error logs"
ON public.error_logs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
