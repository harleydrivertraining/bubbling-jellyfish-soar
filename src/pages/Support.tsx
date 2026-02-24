"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, ArrowLeft, Clock, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import SupportMessageForm from "@/components/SupportMessageForm";
import SupportConversation from "@/components/SupportConversation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
  has_owner_reply?: boolean;
}

const Support: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    setIsOwner(profile?.role === 'owner');

    const { data: msgs, error } = await supabase
      .from("support_messages")
      .select("*, profiles(first_name, last_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to load messages: " + error.message);
    } else if (msgs) {
      // For each message, check if there's a reply from the owner
      const messagesWithReplyStatus = await Promise.all(msgs.map(async (msg) => {
        const { data: replies } = await supabase
          .from("support_replies")
          .select("sender_id, profiles(role)")
          .eq("message_id", msg.id);
        
        const hasOwnerReply = replies?.some(r => (r.profiles as any)?.role === 'owner');
        return { ...msg, has_owner_reply: hasOwnerReply };
      }));
      
      setMessages(messagesWithReplyStatus);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchMessages();
  }, [isSessionLoading, fetchMessages]);

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Support</h1>
        <div className="flex gap-2">
          {isOwner && (
            <Button asChild variant="outline">
              <a href="/admin/support">Admin View</a>
            </Button>
          )}
          {!showNewForm && !selectedMessage && (
            <Button onClick={() => setShowNewForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Request
            </Button>
          )}
        </div>
      </div>

      {(showNewForm || selectedMessage) && (
        <Button variant="ghost" onClick={() => { setShowNewForm(false); setSelectedMessage(null); }} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
        </Button>
      )}

      <div className="grid gap-6">
        {showNewForm ? (
          <Card>
            <CardHeader>
              <CardTitle>New Support Request</CardTitle>
              <CardDescription>Describe your issue and we'll get back to you as soon as possible.</CardDescription>
            </CardHeader>
            <CardContent>
              <SupportMessageForm onSuccess={() => { setShowNewForm(false); fetchMessages(); }} />
            </CardContent>
          </Card>
        ) : selectedMessage ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{selectedMessage.subject}</h2>
              <Badge variant={selectedMessage.status === 'open' ? 'secondary' : 'default'}>
                {selectedMessage.status.toUpperCase()}
              </Badge>
            </div>
            <SupportConversation 
              messageId={selectedMessage.id}
              initialMessage={selectedMessage.message}
              initialCreatedAt={selectedMessage.created_at}
              userFirstName={selectedMessage.profiles?.first_name}
              userLastName={selectedMessage.profiles?.last_name}
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Support Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">No support requests yet.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowNewForm(true)}>
                    Create your first request
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className="py-4 flex items-center justify-between hover:bg-muted/30 px-4 cursor-pointer transition-colors rounded-lg"
                      onClick={() => setSelectedMessage(msg)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">{msg.subject}</h3>
                          {msg.has_owner_reply && (
                            <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-[10px] h-5 px-1.5">
                              <Bell className="mr-1 h-3 w-3" /> REPLIED
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(msg.created_at), "PPP")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={msg.status === 'open' ? 'secondary' : 'default'}>
                          {msg.status}
                        </Badge>
                        <Button variant="ghost" size="sm">View</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Support;