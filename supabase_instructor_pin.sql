-- 1. Update the profile creation function to generate a PIN for instructors
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  new_pin TEXT;
  role_val TEXT;
BEGIN
  -- Determine role: check metadata first, default to 'instructor' for direct signups
  role_val := COALESCE(NEW.raw_user_meta_data->>'role', 'instructor');
  
  -- Only generate a PIN if the user is an instructor
  IF role_val = 'instructor' OR role_val = 'owner' THEN
    -- Generate a random 4-digit PIN (1000-9999)
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
    instructor_pin = EXCLUDED.instructor_pin 
    WHERE profiles.instructor_pin IS NULL AND (profiles.role = 'instructor' OR profiles.role = 'owner');
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure the trigger is correctly attached
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. Assign PINs to any existing instructors who don't have one yet
UPDATE public.profiles 
SET instructor_pin = floor(random() * 9000 + 1000)::text
WHERE instructor_pin IS NULL 
AND (role = 'instructor' OR role = 'owner');