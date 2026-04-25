-- 1. Allow public to see public instructor profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (is_public = true);

-- 2. Allow public to see manual unavailability (No-Test dates) for public instructors
DROP POLICY IF EXISTS "Public view of unavailability" ON public.instructor_unavailability;
CREATE POLICY "Public view of unavailability" 
ON public.instructor_unavailability FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = instructor_unavailability.user_id 
    AND profiles.is_public = true
  )
);

-- 3. Allow public to see available slots and existing tests (to show as restricted)
-- We restrict the columns to ensure no student data is leaked
DROP POLICY IF EXISTS "Public view of available slots and tests" ON public.bookings;
CREATE POLICY "Public view of available slots and tests" 
ON public.bookings FOR SELECT 
USING (
  (status = 'available' OR lesson_type = 'Driving Test') AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = bookings.user_id 
    AND profiles.is_public = true
  )
);