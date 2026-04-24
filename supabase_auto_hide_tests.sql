-- Add the missing column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_hide_test_dates BOOLEAN DEFAULT TRUE;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';