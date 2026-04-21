-- Allow anyone to upload files to dossier-medias bucket (clients are unauthenticated)
CREATE POLICY "Allow public uploads to dossier-medias"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'dossier-medias');

-- Allow anyone to read files from dossier-medias (already public bucket)
CREATE POLICY "Allow public reads from dossier-medias"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dossier-medias');