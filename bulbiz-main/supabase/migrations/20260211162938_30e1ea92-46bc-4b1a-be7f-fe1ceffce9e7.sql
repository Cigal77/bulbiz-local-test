
-- Add soft delete columns to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delete_reason text DEFAULT NULL;

-- Create index for efficient filtering of non-deleted dossiers
CREATE INDEX IF NOT EXISTS idx_dossiers_deleted_at ON public.dossiers (deleted_at) WHERE deleted_at IS NULL;
