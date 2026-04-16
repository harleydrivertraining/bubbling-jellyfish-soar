-- Add new booking preference columns to the profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'gaps',
ADD COLUMN IF NOT EXISTS booking_interval_mins INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS booking_buffer_mins INTEGER DEFAULT 15;

-- Update existing rows to have defaults if they are null
UPDATE profiles SET booking_mode = 'gaps' WHERE booking_mode IS NULL;
UPDATE profiles SET booking_interval_mins = 30 WHERE booking_interval_mins IS NULL;
UPDATE profiles SET booking_buffer_mins = 15 WHERE booking_buffer_mins IS NULL;