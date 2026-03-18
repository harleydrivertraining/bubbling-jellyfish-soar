-- 1. Ensure the column exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='instructor_pin') THEN
    ALTER TABLE public.profiles ADD COLUMN instructor_pin TEXT;
  END IF;
END $$;

-- 2. Force update any existing profiles missing a PIN
UPDATE public.profiles 
SET instructor_pin = floor(random() * 9000 + 1000)::text
WHERE (instructor_pin IS NULL OR instructor_pin = '')
AND (role IS NULL OR role = 'instructor' OR role = 'owner');

-- 3. Update the trigger function to be robust
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  new_pin TEXT;
  role_val TEXT;
BEGIN
  role_val := COALESCE(NEW.raw_user_meta_data->>'role', 'instructor');
  
  IF role_val != 'student' THEN
    new_pin := floor(random() * 9000 + 1000)::text;
  ELSE
    new_pin := NULL;
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, role, instructor_pin)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Instructor'), 
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    role_val,
    new_pin
  )
  ON CONFLICT (id) DO UPDATE SET
    instructor_pin = COALESCE(profiles.instructor_pin, EXCLUDED.instructor_pin),
    role = COALESCE(profiles.role, EXCLUDED.role);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;