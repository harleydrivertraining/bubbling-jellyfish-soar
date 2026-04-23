-- 1. Ensure the extension is enabled in the extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Remove any old version
DROP FUNCTION IF EXISTS public.admin_change_user_password(uuid, text);

-- 3. Create the function with explicit schema references for hashing
CREATE OR REPLACE FUNCTION public.admin_change_user_password(target_user_id uuid, new_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Security Check: Only allow 'owner' role to execute
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform owners can change passwords.';
  END IF;

  -- Update the password in Supabase Auth using schema-qualified hashing functions
  UPDATE auth.users 
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
  WHERE id = target_user_id;
  
  RETURN 'Password updated successfully';
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_change_user_password(uuid, text) TO authenticated;