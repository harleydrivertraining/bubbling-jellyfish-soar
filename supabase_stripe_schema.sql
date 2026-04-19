-- Add Stripe columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
-- subscription_status is already used in the app, ensuring it exists with a default
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing';

-- Create a table to log Stripe events (optional but recommended)
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);