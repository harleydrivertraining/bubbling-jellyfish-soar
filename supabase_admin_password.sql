-- Function to allow owners to change any user's password
CREATE OR REPLACE FUNCTION admin_change_user_password(target_user_id UUID, new_password TEXT)
RETURNS TEXT AS $$
BEGIN
  -- 1. Security Check: Ensure the person calling this is an 'owner'
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform owners can perform this action.';
  END IF;

  -- 2. Update the password in the internal auth table
  -- Supabase uses the pgcrypto extension for this
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
  
  RETURN 'Password updated successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;