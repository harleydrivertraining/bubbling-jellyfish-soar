-- Create the instructor messages table
CREATE TABLE IF NOT EXISTS instructor_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE, -- NULL means broadcast to all
  content TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE instructor_messages ENABLE ROW LEVEL SECURITY;

-- Policies for Instructors
CREATE POLICY "Instructors can manage their own messages" 
ON instructor_messages FOR ALL 
USING (auth.uid() = instructor_id);

-- Policies for Students
CREATE POLICY "Students can view messages sent to them or broadcast" 
ON instructor_messages FOR SELECT 
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM students WHERE id = student_id
  ) OR (
    is_broadcast = true AND 
    auth.uid() IN (SELECT auth_user_id FROM students WHERE user_id = instructor_id)
  )
);