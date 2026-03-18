-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Instructors can manage replies to their messages" ON instructor_message_replies;
DROP POLICY IF EXISTS "Students can manage replies to messages sent to them" ON instructor_message_replies;

-- 1. Policy for Instructors (Full access to replies on their own messages)
CREATE POLICY "Instructors manage own message replies" 
ON instructor_message_replies FOR ALL 
USING (
  auth.uid() IN (
    SELECT instructor_id FROM instructor_messages WHERE id = message_id
  )
);

-- 2. Policy for Students to VIEW replies
-- They can see replies if the parent message was sent to them or was a broadcast from their instructor
CREATE POLICY "Students view relevant replies" 
ON instructor_message_replies FOR SELECT 
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM students WHERE id IN (
      SELECT student_id FROM instructor_messages WHERE id = message_id
    )
  ) OR (
    auth.uid() IN (
      SELECT auth_user_id FROM students WHERE user_id IN (
        SELECT instructor_id FROM instructor_messages WHERE id = message_id AND is_broadcast = true
      )
    )
  )
);

-- 3. Policy for Students to SEND (INSERT) replies
-- They can insert a reply if they are the sender and the message is relevant to them
CREATE POLICY "Students insert own replies" 
ON instructor_message_replies FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND (
    auth.uid() IN (
      SELECT auth_user_id FROM students WHERE id IN (
        SELECT student_id FROM instructor_messages WHERE id = message_id
      )
    ) OR (
      auth.uid() IN (
        SELECT auth_user_id FROM students WHERE user_id IN (
          SELECT instructor_id FROM instructor_messages WHERE id = message_id AND is_broadcast = true
        )
      )
    )
  )
);