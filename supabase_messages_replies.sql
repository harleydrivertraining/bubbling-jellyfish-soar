-- 1. Fix the foreign key to point to profiles instead of auth.users for easier joining
ALTER TABLE instructor_message_replies DROP CONSTRAINT IF EXISTS instructor_message_replies_sender_id_fkey;
ALTER TABLE instructor_message_replies 
  ADD CONSTRAINT instructor_message_replies_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. Create a trigger to automatically create a profile for new users (Students)
-- This ensures that when a student is created, they have a name record the chat can find.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Student'), 
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. Manually create profiles for any existing students who might be missing one
INSERT INTO public.profiles (id, first_name, last_name, role)
SELECT 
  auth_user_id, 
  split_part(name, ' ', 1), 
  substring(name from position(' ' in name) + 1), 
  'student'
FROM students 
WHERE auth_user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;