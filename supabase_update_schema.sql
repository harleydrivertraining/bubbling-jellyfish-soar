-- Add the notes column to the pre_paid_hours_transactions table
ALTER TABLE public.pre_paid_hours_transactions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update the handle_booking_completion function to handle the new column if needed
-- (The trigger doesn't strictly need it for automatic lessons, but it's good for consistency)