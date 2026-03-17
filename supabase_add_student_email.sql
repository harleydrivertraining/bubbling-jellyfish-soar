-- Add email column to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS email TEXT;