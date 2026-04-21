
-- Update generate_quote_number to include client name
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_user_id uuid, p_client_name text DEFAULT NULL)
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
  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count_quotes
  FROM public.quotes
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('year', now());

  IF p_client_name IS NOT NULL AND length(trim(p_client_name)) > 0 THEN
    -- Normalize: remove accents, keep only alphanumeric, uppercase, take first 3 chars
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

-- Update generate_invoice_number to include client name
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_user_id uuid, p_client_name text DEFAULT NULL)
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
