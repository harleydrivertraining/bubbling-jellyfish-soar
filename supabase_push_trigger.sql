-- 1. Create the webhook trigger
CREATE OR REPLACE TRIGGER on_new_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://your-project-ref.functions.supabase.co/push-notifications',
  'POST',
  '{"Content-Type":"application/json", "Authorization":"Bearer YOUR_ANON_KEY"}',
  '{}',
  '1000'
);

-- Note: Replace 'your-project-ref' and 'YOUR_ANON_KEY' with your actual project details.