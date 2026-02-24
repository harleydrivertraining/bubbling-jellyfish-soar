"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Send, User, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reply {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface SupportConversationProps {
  messageId: string;
  initialMessage: string;
  initialCreatedAt: string;
  userFirstName: string;
  userLastName: string;
}

const SupportConversation: React.FC<SupportConversationProps> = ({ 
  messageId, 
  initialMessage, 
  initialCreatedAt,
  userFirstName,
  userLastName
}) => {
  const { user } = useSession();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchReplies = useCallback(async () => {
    const { data, error } = await supabase
      .from("support_replies")
      .select("*, profiles(first_name, last_name, role)")
      .eq("message_id", messageId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching replies:", error);
    } else {
      setReplies(data || []);
    }
  }, [messageId]);

  useEffect(() => {
    fetchReplies();
    
    // Subscribe to new replies
    const channel = supabase
      .channel(`replies-${messageId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_replies',
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
    const { error } = await supabase
      .from("support_replies")
      .insert({
        message_id: messageId,
        sender_id: user.id,
        content: newReply.trim(),
      });

    if (error) {
      showError("Failed to send reply: " + error.message);
    } else {
      setNewReply("");
      fetchReplies();
    }
    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-[500px] border rounded-lg bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {/* Original Message */}
          <div className="flex flex-col items-start">
            <div className="max-w-[85%] rounded-lg p-3 bg-muted text-sm">
              <div className="flex items-center gap-2 mb-1 text-[10px] font-bold text-muted-foreground uppercase">
                <User className="h-3 w-3" />
                {userFirstName} {userLastName} • {format(new Date(initialCreatedAt), "p")}
              </div>
              {initialMessage}
            </div>
          </div>

          {/* Replies */}
          {replies.map((reply) => {
            const isMe = reply.sender_id === user?.id;
            const isOwner = reply.profiles?.role === 'owner';
            
            return (
              <div key={reply.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-lg p-3 text-sm",
                  isMe ? "bg-primary text-primary-foreground" : isOwner ? "bg-blue-50 border border-blue-100 text-blue-900" : "bg-muted"
                )}>
                  <div className={cn(
                    "flex items-center gap-2 mb-1 text-[10px] font-bold uppercase",
                    isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {isOwner ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {reply.profiles?.first_name} {reply.profiles?.last_name} {isOwner && "(Owner)"} • {format(new Date(reply.created_at), "p")}
                  </div>
                  {reply.content}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/30">
        <div className="flex gap-2">
          <Textarea 
            placeholder="Type your message..." 
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            className="min-h-[40px] max-h-[120px] bg-background"
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
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SupportConversation;