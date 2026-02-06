-- This script creates a trigger that automatically marks new users as confirmed.
-- Run this in your Supabase SQL Editor.

-- 1. Create the function that will handle the confirmation
CREATE OR REPLACE FUNCTION public.handle_new_user_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- We only update email_confirmed_at. 
  -- In newer Supabase versions, 'confirmed_at' is a generated column 
  -- that automatically updates when email_confirmed_at is set.
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on the auth.users table
-- We use AFTER INSERT because we need the user record to exist first
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_confirmation();

-- 3. (Optional) Uncomment the line below to confirm all existing users who haven't confirmed yet
-- UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;