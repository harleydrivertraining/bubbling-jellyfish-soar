"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { Send, User, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reply {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface MessageConversationProps {
  messageId: string;
  instructorId: string;
  studentId: string | null;
  isBroadcast: boolean;
  maxHeight?: string;
}

const MessageConversation: React.FC<MessageConversationProps> = ({ 
  messageId, 
  instructorId,
  studentId,
  isBroadcast,
  maxHeight = "300px"
}) => {
  const { user } = useSession();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchReplies = useCallback(async () => {
    // If it's a broadcast, we only want to see replies from THIS student if we are a student,
    // or ALL replies if we are the instructor.
    let query = supabase
      .from("instructor_message_replies")
      .select("*, profiles:sender_id(first_name, last_name, role)")
      .eq("message_id", messageId)
      .order("created_at", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching replies:", error);
    } else {
      setReplies(data || []);
    }
  }, [messageId]);

  useEffect(() => {
    fetchReplies();
    
    const channel = supabase
      .channel(`msg-replies-${messageId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'instructor_message_replies',
        filter: `message_id=eq.${messageId}`
      }, () => {
        fetchReplies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, fetchReplies]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies]);

  const handleSendReply = async () => {
    if (!user || !newReply.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from("instructor_message_replies")
        .insert({
          message_id: messageId,
          sender_id: user.id,
          content: newReply.trim(),
        });

      if (error) throw error;

      // Notify the other party
      const isInstructor = user.id === instructorId;
      let targetUserId = instructorId;
      
      if (isInstructor && studentId) {
        // Find student's auth user id
        const { data: sData } = await supabase.from("students").select("auth_user_id").eq("id", studentId).single();
        if (sData?.auth_user_id) targetUserId = sData.auth_user_id;
      }

      if (targetUserId !== user.id) {
        await supabase.from("notifications").insert({
          user_id: targetUserId,
          title: "New Message Reply",
          message: isInstructor ? "Your instructor replied to your message." : "A student has replied to your message.",
          type: "instructor_message"
        });
      }

      setNewReply("");
      fetchReplies();
    } catch (error: any) {
      showError("Failed to send reply: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  if (replies.length === 0 && !isSending && user?.id === instructorId && isBroadcast) {
    return <p className="text-[10px] text-muted-foreground italic px-4 pb-2">No replies yet.</p>;
  }

  return (
    <div className="flex flex-col space-y-4 mt-2">
      {replies.length > 0 && (
        <ScrollArea className={cn("border rounded-lg bg-muted/10 p-3")} style={{ maxHeight }}>
          <div className="space-y-3">
            {replies.map((reply) => {
              const isMe = reply.sender_id === user?.id;
              const role = (reply.profiles as any)?.role;
              const isInstructor = role === 'instructor' || role === 'owner';
              
              return (
                <div key={reply.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-lg p-2 text-xs",
                    isMe ? "bg-primary text-primary-foreground" : "bg-muted border"
                  )}>
                    <div className={cn(
                      "flex items-center gap-1.5 mb-1 text-[9px] font-bold uppercase",
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {isInstructor ? <ShieldCheck className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                      {reply.profiles?.first_name} • {format(parseISO(reply.created_at), "p")}
                    </div>
                    {reply.content}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <div className="flex gap-2">
        <Textarea 
          placeholder="Type a reply..." 
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          className="min-h-[40px] max-h-[100px] text-xs bg-background"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendReply();
            }
          }}
        />
        <Button 
          size="icon" 
          onClick={handleSendReply} 
          disabled={isSending || !newReply.trim()}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MessageConversation;