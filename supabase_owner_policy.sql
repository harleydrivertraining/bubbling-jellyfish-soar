-- 1. Remove the problematic recursive policy
DROP POLICY IF EXISTS "Owners can update all profiles" ON public.profiles;

-- 2. Create a helper function that checks if the current user is an owner
-- This function uses 'SECURITY DEFINER' to bypass the RLS loop
CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT (role = 'owner')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the new, non-recursive policy using the helper function
CREATE POLICY "Owners can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (is_owner())
WITH CHECK (is_owner());

-- 4. Also allow owners to VIEW all profiles (needed for the admin list)
DROP POLICY IF EXISTS "Owners can view all profiles" ON public.profiles;
CREATE POLICY "Owners can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (is_owner() OR id = auth.uid());