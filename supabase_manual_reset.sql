-- Create a function that can be called by unauthenticated users
CREATE OR REPLACE FUNCTION public.request_manual_password_reset(user_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges to insert notifications
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  owner_count int := 0;
BEGIN
  -- 1. Find all users with the 'owner' role
  FOR owner_id IN SELECT id FROM public.profiles WHERE role = 'owner' LOOP
    -- 2. Insert a notification for each owner
    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (
      owner_id,
      'Password Reset Request',
      'The user with email ' || user_email || ' has requested a password reset. You can change their password in the Instructor Directory.',
      'password_reset_request',
      false
    );
    owner_count := owner_count + 1;
  END LOOP;

  IF owner_count = 0 THEN
    RETURN json_build_object('success', false, 'message', 'No administrators found to handle request.');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Allow public (anon) access so logged-out users can request a reset
GRANT EXECUTE ON FUNCTION public.request_manual_password_reset(text) TO anon, authenticated;