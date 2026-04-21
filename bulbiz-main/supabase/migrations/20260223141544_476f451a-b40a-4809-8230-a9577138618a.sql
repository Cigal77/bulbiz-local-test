
-- Drop overly permissive public storage policies
DROP POLICY IF EXISTS "Allow public uploads to dossier-medias" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from dossier-medias" ON storage.objects;

-- Authenticated users can upload to their own folder (user_id/dossier_id/...)
CREATE POLICY "Authenticated upload to own dossier-medias"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'dossier-medias' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can read/list files in their own folder
CREATE POLICY "Authenticated read own dossier-medias"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'dossier-medias' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete files in their own folder
CREATE POLICY "Authenticated delete own dossier-medias"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'dossier-medias' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);
