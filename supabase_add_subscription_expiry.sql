-- Add subscription_expiry column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_expiry DATE;

-- Update the admin RPC to include the new field
OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  logo_url TEXT,
  role TEXT,
  updated_at TIMESTAMPTZ,
  subscription_status TEXT,
  subscription_expiry DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.logo_url,
    p.role,
    p.updated_at,
    p.subscription_status,
    p.subscription_expiry
  FROM public.profiles p
  ORDER BY p.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;