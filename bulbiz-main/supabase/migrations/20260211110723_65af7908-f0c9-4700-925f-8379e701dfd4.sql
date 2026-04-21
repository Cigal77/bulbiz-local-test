
-- Add media_category and duration columns to medias table
ALTER TABLE public.medias 
ADD COLUMN IF NOT EXISTS media_category text NOT NULL DEFAULT 'image',
ADD COLUMN IF NOT EXISTS duration integer NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.medias.media_category IS 'One of: image, video, audio, plan';
COMMENT ON COLUMN public.medias.duration IS 'Duration in seconds for audio/video files';

-- Index for faster queries by dossier + category
CREATE INDEX IF NOT EXISTS idx_medias_dossier_category ON public.medias(dossier_id, media_category);

-- Update existing records based on file_type
UPDATE public.medias SET media_category = 'video' WHERE file_type LIKE 'video/%';
UPDATE public.medias SET media_category = 'audio' WHERE file_type LIKE 'audio/%';
UPDATE public.medias SET media_category = 'plan' WHERE file_type = 'application/pdf';
