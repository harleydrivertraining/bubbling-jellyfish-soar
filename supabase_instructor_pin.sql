-- 1. Force update any existing profiles missing a PIN
-- This targets anyone who isn't explicitly a 'student'
UPDATE public.profiles 
SET instructor_pin = floor(random() * 9000 + 1000)::text
WHERE (instructor_pin IS NULL OR instructor_pin = '')
AND (role IS NULL OR role = 'instructor' OR role = 'owner');

-- 2. Update the function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  new_pin TEXT;
  role_val TEXT;
BEGIN
  -- Default to instructor if not specified
  role_val := COALESCE(NEW.raw_user_meta_data->>'role', 'instructor');
  
  -- Generate PIN for anyone who isn't a student
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

-- 3. Re-verify trigger
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();