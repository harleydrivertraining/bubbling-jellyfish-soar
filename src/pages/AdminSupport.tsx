"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { User, ArrowLeft, MessageSquare, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import SupportConversation from "@/components/SupportConversation";

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

const AdminSupport: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);

  const fetchAllMessages = useCallback(async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (profile?.role !== 'owner') {
      navigate("/support");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("support_messages")
      .select("*, profiles(first_name, last_name)")
      .order("status", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to load messages: " + error.message);
    } else {
      setMessages(data || []);
    }
    setIsLoading(false);
  }, [user, navigate]);

  useEffect(() => {
    if (!isSessionLoading) fetchAllMessages();
  }, [isSessionLoading, fetchAllMessages]);

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedMessage && (
            <Button variant="ghost" size="icon" onClick={() => setSelectedMessage(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-3xl font-bold">Admin Support Center</h1>
        </div>
      </div>

      {selectedMessage ? (
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{selectedMessage.subject}</h2>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <User className="h-4 w-4" />
                From: {selectedMessage.profiles?.first_name} {selectedMessage.profiles?.last_name}
              </p>
            </div>
            <Badge variant={selectedMessage.status === 'open' ? 'default' : 'secondary'}>
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
            <CardTitle>All Support Requests</CardTitle>
            <CardDescription>Manage and respond to instructor support requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground">No support requests found.</p>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "py-4 flex items-center justify-between hover:bg-muted/30 px-4 cursor-pointer transition-colors rounded-lg",
                      msg.status === 'open' && "bg-primary/5"
                    )}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{msg.subject}</h3>
                        {msg.status === 'open' && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {msg.profiles?.first_name} {msg.profiles?.last_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(msg.created_at), "PPP p")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={msg.status === 'open' ? 'default' : 'secondary'}>
                        {msg.status}
                      </Badge>
                      <Button variant="ghost" size="sm">Open Thread</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminSupport;