-- 1. Create the parent messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS instructor_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE, -- NULL means broadcast
  content TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create the replies table
CREATE TABLE IF NOT EXISTS instructor_message_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES instructor_messages(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE instructor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_message_replies ENABLE ROW LEVEL SECURITY;

-- 4. Policies for instructor_messages
DROP POLICY IF EXISTS "Instructors can manage their own messages" ON instructor_messages;
CREATE POLICY "Instructors can manage their own messages" 
ON instructor_messages FOR ALL 
USING (auth.uid() = instructor_id);

DROP POLICY IF EXISTS "Students can view relevant messages" ON instructor_messages;
CREATE POLICY "Students can view relevant messages" 
ON instructor_messages FOR SELECT 
USING (
  auth.uid() IN (SELECT auth_user_id FROM students WHERE id = student_id) OR 
  (is_broadcast = true AND auth.uid() IN (SELECT auth_user_id FROM students WHERE user_id = instructor_id))
);

-- 5. Policies for instructor_message_replies
DROP POLICY IF EXISTS "Instructors manage own message replies" ON instructor_message_replies;
CREATE POLICY "Instructors manage own message replies" 
ON instructor_message_replies FOR ALL 
USING (
  auth.uid() IN (SELECT instructor_id FROM instructor_messages WHERE id = message_id)
);

DROP POLICY IF EXISTS "Students view relevant replies" ON instructor_message_replies;
CREATE POLICY "Students view relevant replies" 
ON instructor_message_replies FOR SELECT 
USING (
  auth.uid() IN (SELECT auth_user_id FROM students WHERE id IN (SELECT student_id FROM instructor_messages WHERE id = message_id)) OR
  auth.uid() IN (SELECT auth_user_id FROM students WHERE user_id IN (SELECT instructor_id FROM instructor_messages WHERE id = message_id AND is_broadcast = true))
);

DROP POLICY IF EXISTS "Students insert own replies" ON instructor_message_replies;
CREATE POLICY "Students insert own replies" 
ON instructor_message_replies FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND (
    auth.uid() IN (SELECT auth_user_id FROM students WHERE id IN (SELECT student_id FROM instructor_messages WHERE id = message_id)) OR
    auth.uid() IN (SELECT auth_user_id FROM students WHERE user_id IN (SELECT instructor_id FROM instructor_messages WHERE id = message_id AND is_broadcast = true))
  )
);