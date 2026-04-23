-- 1. Remove any old version to prevent conflicts
DROP FUNCTION IF EXISTS public.request_manual_password_reset(text);

-- 2. Create the function
CREATE OR REPLACE FUNCTION public.request_manual_password_reset(user_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- This is critical: it allows the function to bypass RLS to send the notification
SET search_path = public
AS $$
DECLARE
  owner_record RECORD;
  owner_count int := 0;
BEGIN
  -- Find all users with the 'owner' role
  FOR owner_record IN SELECT id FROM public.profiles WHERE role = 'owner' LOOP
    -- Insert a notification for each owner
    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (
      owner_record.id,
      'Password Reset Request',
      'The user with email ' || user_email || ' has requested a password reset. You can change their password in the Instructor Directory.',
      'password_reset_request',
      false
    );
    owner_count := owner_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'owners_notified', owner_count);
END;
$$;

-- 3. Grant permissions to everyone (including logged-out users)
GRANT EXECUTE ON FUNCTION public.request_manual_password_reset(text) TO anon, authenticated;