-- 1. Enable the HTTP extension if not already enabled
create extension if not exists pg_net;

-- 2. Create the function that sends the email
create or replace function public.handle_booking_claimed_email()
returns trigger
language plpgsql
security definer
as $$
declare
  resend_api_key text := 're_Ba7SxYXj_967iieeP97NbXdnZwGe55kpL'; -- Your API Key
  instructor_email text;
  instructor_name text;
  student_name text;
  email_enabled boolean;
begin
  -- Only proceed if a student was just assigned to an available slot
  if (old.student_id is null and new.student_id is not null) then
    
    -- Get instructor details and preferences
    select email, first_name, email_notifications_enabled 
    into instructor_email, instructor_name, email_enabled
    from public.profiles 
    where id = new.user_id;

    -- Get student name
    select name into student_name
    from public.students
    where id = new.student_id;

    -- Only send if instructor has an email and has enabled alerts
    if (instructor_email is not null and email_enabled = true) then
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
          'html', '<h1>New Lesson Booked!</h1>' ||
                  '<p><strong>' || student_name || '</strong> has booked a slot.</p>' ||
                  '<p><strong>Time:</strong> ' || to_char(new.start_time at time zone 'UTC', 'Day, DD Mon HH24:MI') || '</p>'
        )
      );
    end if;
  end if;
  
  return new;
end;
$$;

-- 3. Create the trigger
drop trigger if exists on_booking_claimed_email on public.bookings;
create trigger on_booking_claimed_email
  after update on public.bookings
  for each row
  execute function public.handle_booking_claimed_email();