-- 1. Ensure the password hashing extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Remove any old version to prevent conflicts
DROP FUNCTION IF EXISTS public.admin_change_user_password(uuid, text);

-- 3. Create the function with explicit schema references
CREATE OR REPLACE FUNCTION public.admin_change_user_password(target_user_id uuid, new_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to access auth.users
SET search_path = public, auth
AS $$
BEGIN
  -- Security Check: Only allow 'owner' role to execute
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform owners can change passwords.';
  END IF;

  -- Update the password in Supabase Auth
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
  
  RETURN 'Password updated successfully';
END;
$$;

-- 4. Explicitly allow authenticated users to call the function
-- (The internal check above ensures only owners actually succeed)
GRANT EXECUTE ON FUNCTION public.admin_change_user_password(uuid, text) TO authenticated;