-- Add SMS columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notif_lesson_booked_sms BOOLEAN DEFAULT false;

-- Update the send_test_email function to include a test SMS placeholder if needed
-- (This is just for schema reference)