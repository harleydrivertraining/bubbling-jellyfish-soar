-- Add the booking notice setting to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS min_booking_notice_hours INTEGER DEFAULT 48;