-- 1. Enable the pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the RPC function
CREATE OR REPLACE FUNCTION request_password_reset_sql(user_email text, origin_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to access auth.admin
SET search_path = public, auth
AS $$
DECLARE
  recovery_link_json jsonb;
  recovery_link text;
  resend_api_key text := 'YOUR_RESEND_API_KEY'; -- REPLACE THIS WITH YOUR ACTUAL KEY
  http_id bigint;
BEGIN
  -- 1. Generate the secure recovery link using Supabase Auth Admin
  -- This link will point to your /reset-password page
  SELECT auth.admin.generate_link(
    'recovery',
    user_email,
    origin_url || '/reset-password'
  ) INTO recovery_link_json;

  IF recovery_link_json IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found or link generation failed');
  END IF;

  recovery_link := recovery_link_json->'properties'->>'action_link';

  -- 2. Send the email via Resend API using pg_net (asynchronous)
  SELECT net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'HDT App <notifications@drivinginstructorapp.co.uk>',
      'to', ARRAY[user_email],
      'subject', 'Reset Your Password - Instructor App',
      'html', '
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h1 style="color: #1e293b; font-size: 24px; font-weight: 800; margin-bottom: 16px;">Password Reset Request</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.5;">We received a request to reset your password. Click the button below to choose a new one:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="' || recovery_link || '" style="background-color: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">If you didn''t request this, you can safely ignore this email. The link will expire shortly.</p>
        </div>'
    )
  ) INTO http_id;

  RETURN jsonb_build_object('success', true, 'message', 'Reset email queued', 'job_id', http_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;