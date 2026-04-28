-- Add missing columns for public profile management
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS show_availability_publicly BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_hide_test_dates BOOLEAN DEFAULT true;

-- Refresh the schema cache (Supabase does this automatically, but good to have)
NOTIFY pgrst, 'reload schema';