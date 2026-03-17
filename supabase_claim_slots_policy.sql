-- 1. Allow students to update a booking ONLY if it is currently 'available'
-- and belongs to their instructor.
CREATE POLICY "Students can claim available slots" 
ON public.bookings 
FOR UPDATE 
TO authenticated 
USING (
  status = 'available' AND 
  user_id IN (
    SELECT user_id FROM public.students WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  status = 'scheduled' AND 
  student_id IN (
    SELECT id FROM public.students WHERE auth_user_id = auth.uid()
  )
);

-- 2. Ensure students can see their own scheduled/completed bookings
-- (In case this policy doesn't exist yet)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'bookings' AND policyname = 'Students can view their own bookings'
    ) THEN
        CREATE POLICY "Students can view their own bookings" 
        ON public.bookings 
        FOR SELECT 
        TO authenticated 
        USING (
          student_id IN (
            SELECT id FROM public.students WHERE auth_user_id = auth.uid()
          )
        );
    END IF;
END $$;