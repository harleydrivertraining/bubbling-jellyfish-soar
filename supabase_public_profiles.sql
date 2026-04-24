-- Add public profile columns if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_slug TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_bio TEXT;

-- Create a unique index on public_slug to ensure URLs are unique
-- We use a filter to allow multiple NULL values (for users who haven't set a slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_slug ON profiles (public_slug) WHERE public_slug IS NOT NULL;

-- Ensure RLS allows public reading of public profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (is_public = true);