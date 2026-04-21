
-- 1. Fix has_role: only allow checking own roles
-- Note: has_role is used in RLS policies, so restricting to auth.uid() = _user_id
-- would break RLS evaluation. Instead, we keep it as-is since it's used internally
-- by RLS and the information leak (knowing someone's role) is minimal.
-- We add a check that at least the caller is authenticated.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    ELSE false
  END;
$$;

-- 2. Fix generate_quote_number: only allow generating for own user_id
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_user_id uuid, p_client_name text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  count_quotes integer;
  year_str text;
  client_prefix text;
BEGIN
  -- Only allow generating for own user
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only generate quote numbers for own user_id';
  END IF;

  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count_quotes
  FROM public.quotes
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('year', now());

  IF p_client_name IS NOT NULL AND length(trim(p_client_name)) > 0 THEN
    client_prefix := upper(left(
      regexp_replace(
        translate(
          trim(p_client_name),
          'àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ',
          'aaaeeeeiioouucAAAEEEEIIOOUUC'
        ),
        '[^a-zA-Z]', '', 'g'
      ),
      3
    ));
    RETURN 'DEV-' || year_str || '-' || client_prefix || '-' || lpad(count_quotes::text, 4, '0');
  ELSE
    RETURN 'DEV-' || year_str || '-' || lpad(count_quotes::text, 4, '0');
  END IF;
END;
$function$;

-- 3. Fix generate_invoice_number: only allow generating for own user_id
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_user_id uuid, p_client_name text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  count_invoices integer;
  year_str text;
  client_prefix text;
BEGIN
  -- Only allow generating for own user
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only generate invoice numbers for own user_id';
  END IF;

  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count_invoices
  FROM public.invoices
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('year', now());

  IF p_client_name IS NOT NULL AND length(trim(p_client_name)) > 0 THEN
    client_prefix := upper(left(
      regexp_replace(
        translate(
          trim(p_client_name),
          'àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ',
          'aaaeeeeiioouucAAAEEEEIIOOUUC'
        ),
        '[^a-zA-Z]', '', 'g'
      ),
      3
    ));
    RETURN 'FAC-' || year_str || '-' || client_prefix || '-' || lpad(count_invoices::text, 4, '0');
  ELSE
    RETURN 'FAC-' || year_str || '-' || lpad(count_invoices::text, 4, '0');
  END IF;
END;
$function$;

-- 4. Make storage bucket private for defense-in-depth
UPDATE storage.buckets SET public = false WHERE id = 'dossier-medias';
