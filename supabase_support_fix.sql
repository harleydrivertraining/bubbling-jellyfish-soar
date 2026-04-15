-- 1. Fix support_replies permissions
-- Allow users to reply to their own messages AND owners to reply to anything
DROP POLICY IF EXISTS "Users can insert replies to their own messages" ON support_replies;
DROP POLICY IF EXISTS "Owners can insert replies to any message" ON support_replies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON support_replies;

CREATE POLICY "Enable insert for support replies" 
ON support_replies FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (
      SELECT 1 FROM support_messages 
      WHERE id = message_id AND user_id = auth.uid()
    ) OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
  )
);

-- Ensure owners can see all replies and users can see replies to their own messages
DROP POLICY IF EXISTS "Users can view replies to their messages" ON support_replies;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON support_replies;

CREATE POLICY "Enable select for support replies" 
ON support_replies FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM support_messages 
    WHERE id = message_id AND user_id = auth.uid()
  ) OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
);

-- 2. Fix support_messages permissions for status updates
-- Allow owners to update the status (open/closed) of any message
DROP POLICY IF EXISTS "Owners can update support message status" ON support_messages;

CREATE POLICY "Owners can update support message status" 
ON support_messages FOR UPDATE 
TO authenticated 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
);