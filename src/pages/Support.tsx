"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import SupportMessageForm from "@/components/SupportMessageForm";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  response?: string;
  responded_at?: string;
  created_at: string;
}

const Support: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    setIsOwner(profile?.role === 'owner');

    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to load messages: " + error.message);
    } else {
      setMessages(data || []);
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Support</h1>
        {isOwner && (
          <Button asChild variant="outline">
            <a href="/admin/support">Go to Admin View</a>
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">New Message</CardTitle>
            <CardDescription>Send a message to the app owner.</CardDescription>
          </CardHeader>
          <CardContent>
            <SupportMessageForm onSuccess={fetchMessages} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Message History</CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No messages sent yet.</p>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <Card key={msg.id} className="bg-muted/30">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold">{msg.subject}</h3>
                          <Badge variant={msg.status === 'open' ? 'secondary' : 'default'}>
                            {msg.status}
                          </Badge>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <div className="text-[10px] text-muted-foreground flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {format(new Date(msg.created_at), "PPP p")}
                        </div>
                        
                        {msg.response && (
                          <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                              <span className="text-xs font-bold text-primary">Response from Owner:</span>
                            </div>
                            <p className="text-sm italic">{msg.response}</p>
                            {msg.responded_at && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {format(new Date(msg.responded_at), "PPP p")}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Support;