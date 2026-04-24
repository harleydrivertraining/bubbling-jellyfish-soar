-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('storage2', 'storage2', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove old policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "User Upload" ON storage.objects;
DROP POLICY IF EXISTS "User Update Delete" ON storage.objects;

-- 1. Allow anyone to view files (Public Read)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'storage2');

-- 2. Allow authenticated users to upload to their own folder
-- The path must start with their user ID (e.g., 'user-uuid/logo.png')
CREATE POLICY "User Upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'storage2' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow users to update or delete their own files
CREATE POLICY "User Update Delete" 
ON storage.objects FOR ALL 
TO authenticated 
USING (
  bucket_id = 'storage2' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);