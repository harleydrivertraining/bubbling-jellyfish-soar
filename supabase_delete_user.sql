-- This function allows an 'owner' to delete a user from the auth.users table.
-- It includes a security check to ensure only users with the 'owner' role can execute it.

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requestor_role TEXT;
BEGIN
  -- 1. Check if the person calling the function is an owner
  SELECT role INTO requestor_role FROM public.profiles WHERE id = auth.uid();
  
  IF requestor_role IS NULL OR requestor_role != 'owner' THEN
    RAISE EXCEPTION 'Access Denied: Only platform owners can delete accounts.';
  END IF;

  -- 2. Prevent owners from deleting themselves (safety measure)
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own owner account from this menu.';
  END IF;

  -- 3. Delete the user from auth.users
  -- This will automatically trigger deletions in the profiles table 
  -- and other tables if ON DELETE CASCADE is set on foreign keys.
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Grant execute permission to authenticated users (the function itself checks for 'owner' role)
GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO authenticated;