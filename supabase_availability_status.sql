-- Ensure the status column can accept 'available'
-- If you have a check constraint, this will update it. 
-- If it's just a text column, this is just for documentation.
COMMENT ON COLUMN public.bookings.status IS 'Can be: scheduled, completed, cancelled, or available';