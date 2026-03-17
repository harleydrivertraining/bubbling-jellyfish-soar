-- Allow students to see 'available' slots from their instructor
-- This policy allows a student to see any booking where the status is 'available' 
-- AND the booking belongs to the instructor who is linked to that student.

CREATE POLICY "Students can view available slots from their instructor" 
ON public.bookings 
FOR SELECT 
TO authenticated 
USING (
  status = 'available' AND 
  user_id IN (
    SELECT user_id FROM public.students WHERE auth_user_id = auth.uid()
  )
);