-- Add private_notes column to student_progress_entries
ALTER TABLE public.student_progress_entries 
ADD COLUMN IF NOT EXISTS private_notes TEXT;

-- Update the comment column description to clarify it's for pupils
COMMENT ON COLUMN public.student_progress_entries.comment IS 'Notes visible to the pupil';
COMMENT ON COLUMN public.student_progress_entries.private_notes IS 'Notes only visible to the instructor';