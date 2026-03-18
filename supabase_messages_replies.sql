-- Create the replies table for instructor messages
CREATE TABLE IF NOT EXISTS instructor_message_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES instructor_messages(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE instructor_message_replies ENABLE ROW LEVEL SECURITY;

-- Policies for Instructors
CREATE POLICY "Instructors can manage replies to their messages" 
ON instructor_message_replies FOR ALL 
USING (
  auth.uid() IN (
    SELECT instructor_id FROM instructor_messages WHERE id = message_id
  )
);

-- Policies for Students
CREATE POLICY "Students can manage replies to messages sent to them" 
ON instructor_message_replies FOR ALL 
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM students WHERE id IN (
      SELECT student_id FROM instructor_messages WHERE id = message_id
    )
  ) OR (
    -- Allow replying to broadcasts if the student belongs to that instructor
    auth.uid() IN (
      SELECT auth_user_id FROM students WHERE user_id IN (
        SELECT instructor_id FROM instructor_messages WHERE id = message_id AND is_broadcast = true
      )
    )
  )
);