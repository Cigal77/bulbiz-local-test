ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS discount_unit text NOT NULL DEFAULT 'PERCENT'
  CHECK (discount_unit IN ('PERCENT','EUR'));