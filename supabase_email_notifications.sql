-- 1. Enable the pg_net extension to allow HTTP requests from SQL
create extension if not exists pg_net;

-- 2. Create the trigger function
create or replace function public.notify_instructor_on_booking()
returns trigger
language plpgsql
security definer
as $$
declare
  instructor_email text;
  student_name text;
  -- IMPORTANT: Replace the string below with your actual Resend API Key
  resend_api_key text := 'YOUR_RESEND_API_KEY_HERE'; 
begin
  -- Only proceed if the status changed from 'available' to 'scheduled'
  -- and a student has been assigned
  if (OLD.status = 'available' and NEW.status = 'scheduled' and NEW.student_id is not null) then
    
    -- Get instructor email and check if notifications are enabled
    select email into instructor_email 
    from public.profiles 
    where id = NEW.user_id 
    and email_notifications_enabled = true;

    -- Get student name
    select name into student_name 
    from public.students 
    where id = NEW.student_id;

    -- If we have an email, send the request to Resend
    if instructor_email is not null and instructor_email != '' then
      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || resend_api_key
        ),
        body := jsonb_build_object(
          'from', 'HDT App <onboarding@resend.dev>',
          'to', jsonb_build_array(instructor_email),
          'subject', 'New Lesson Booked: ' || student_name,
          'html', '<h1>New Lesson Booked!</h1><p><strong>' || student_name || '</strong> has booked the slot on ' || to_char(NEW.start_time, 'Day, DD Mon HH24:MI') || '.</p><p>Check your app for details.</p>'
        )
      );
    end if;
  end if;
  
  return NEW;
end;
$$;

-- 3. Create the trigger on the bookings table
drop trigger if exists on_booking_claimed on public.bookings;
create trigger on_booking_claimed
  after update on public.bookings
  for each row
  execute function public.notify_instructor_on_booking();