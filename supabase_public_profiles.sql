-- Add public fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Create table for manual unavailability (e.g. holidays or "no test" dates)
CREATE TABLE IF NOT EXISTS instructor_unavailability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  type TEXT DEFAULT 'no_tests', -- 'no_tests' or 'fully_unavailable'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE instructor_unavailability ENABLE ROW LEVEL SECURITY;

-- Policies for unavailability
CREATE POLICY "Instructors can manage their own unavailability" 
  ON instructor_unavailability FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view unavailability" 
  ON instructor_unavailability FOR SELECT 
  USING (true);

-- Public access policy for profiles (allow viewing public ones)
CREATE POLICY "Anyone can view public profiles" 
  ON profiles FOR SELECT 
  USING (is_public = true OR auth.uid() = id);