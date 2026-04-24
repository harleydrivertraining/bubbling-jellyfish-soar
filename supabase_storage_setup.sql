-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('storage2', 'storage2', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to all files in storage2
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'storage2');

-- Allow authenticated users to upload files to storage2
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'storage2' AND auth.role() = 'authenticated');

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'storage2' AND (auth.uid() = owner OR auth.uid()::text = (storage.foldername(name))[1]));