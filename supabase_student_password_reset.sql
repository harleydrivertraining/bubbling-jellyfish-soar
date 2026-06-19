-- Ensure the pgcrypto extension is enabled (usually in the extensions schema in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Create a secure function to allow instructors to change their students' passwords
CREATE OR REPLACE FUNCTION public.instructor_change_student_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to update auth.users
SET search_path = public, auth, extensions
AS $$
DECLARE
  is_instructor BOOLEAN;
  encrypted_pw TEXT;
BEGIN
  -- 1. Verify that the calling user (auth.uid()) is the instructor of the target student
  SELECT EXISTS (
    SELECT 1 
    FROM public.students 
    WHERE user_id = auth.uid() 
      AND auth_user_id = target_user_id
  ) INTO is_instructor;

  -- If the caller is not the instructor, deny access
  IF NOT is_instructor THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: You are not the instructor for this student.');
  END IF;

  -- 2. Encrypt the new password using crypt (standard Supabase auth encryption)
  -- Explicitly referencing extensions schema to avoid search_path issues
  encrypted_pw := extensions.crypt(new_password, extensions.gen_salt('bf'));

  -- 3. Update the password in auth.users
  UPDATE auth.users
  SET encrypted_password = encrypted_pw,
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permission to authenticated users (instructors)
GRANT EXECUTE ON FUNCTION public.instructor_change_student_password(UUID, TEXT) TO authenticated;