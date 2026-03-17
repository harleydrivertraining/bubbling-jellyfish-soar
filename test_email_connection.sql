-- Run this to test if your API key and pg_net extension are working.
-- REPLACE 'YOUR_RESEND_API_KEY' and 'YOUR_EMAIL@EXAMPLE.COM'
select net.http_post(
  url := 'https://api.resend.com/emails',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR_RESEND_API_KEY'
  ),
  body := jsonb_build_object(
    'from', 'HDT App <onboarding@resend.dev>',
    'to', jsonb_build_array('YOUR_EMAIL@EXAMPLE.COM'),
    'subject', 'Test from Supabase',
    'html', '<p>If you see this, your database connection to Resend is working!</p>'
  )
);

-- After running this, check the 'net.http_responses' table to see the result:
-- select * from net.http_responses order by created_at desc limit 1;