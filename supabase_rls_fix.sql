-- 1. Allow instructors to see ALL progress entries for their students
-- This is the key fix that allows you to see entries created by the pupils.
CREATE POLICY "Instructors can view their students' progress entries" 
ON public.student_progress_entries 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE students.id = student_progress_entries.student_id 
    AND students.user_id = auth.uid()
  )
);

-- 2. Allow students to see their own progress entries
-- This ensures pupils can see the ratings you give them and the ones they give themselves.
CREATE POLICY "Students can view their own progress entries" 
ON public.student_progress_entries 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE students.id = student_progress_entries.student_id 
    AND students.auth_user_id = auth.uid()
  )
);

-- 3. Allow students to insert their own progress entries
-- This allows pupils to save their self-assessments.
CREATE POLICY "Students can insert their own progress entries" 
ON public.student_progress_entries 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE students.id = student_progress_entries.student_id 
    AND students.auth_user_id = auth.uid()
  )
);