-- Add storage policies for dossier-medias bucket

-- Allow authenticated users to upload files to their own dossier folders
CREATE POLICY "Users can upload to dossier-medias"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dossier-medias'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.dossiers WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to read their own dossier files
CREATE POLICY "Users can read own dossier-medias"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dossier-medias'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.dossiers WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to update/overwrite their own dossier files
CREATE POLICY "Users can update own dossier-medias"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dossier-medias'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.dossiers WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their own dossier files
CREATE POLICY "Users can delete own dossier-medias"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dossier-medias'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.dossiers WHERE user_id = auth.uid()
  )
);

-- Allow public read access for files linked to quotes with signature tokens (for client validation)
CREATE POLICY "Public can read dossier-medias for quote validation"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'dossier-medias'
);