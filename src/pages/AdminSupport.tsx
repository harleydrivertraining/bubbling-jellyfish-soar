"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  response?: string;
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
  const [responses, setResponses] = useState<{ [key: string]: string }>({});

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

  const handleSendResponse = async (msgId: string) => {
    const responseText = responses[msgId];
    if (!responseText?.trim()) return;

    const { error } = await supabase
      .from("support_messages")
      .update({
        response: responseText,
        status: 'closed',
        responded_at: new Date().toISOString(),
      })
      .eq("id", msgId);

    if (error) {
      showError("Failed to send response: " + error.message);
    } else {
      showSuccess("Response sent!");
      setResponses(prev => ({ ...prev, [msgId]: "" }));
      fetchAllMessages();
    }
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/support"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-3xl font-bold">Admin Support Center</h1>
      </div>

      <div className="grid gap-4">
        {messages.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No support messages found.</CardContent></Card>
        ) : (
          messages.map((msg) => (
            <Card key={msg.id} className={cn(msg.status === 'open' ? "border-primary/50" : "opacity-80")}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{msg.subject}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {msg.profiles?.first_name} {msg.profiles?.last_name} • {format(new Date(msg.created_at), "PPP p")}
                    </CardDescription>
                  </div>
                  <Badge variant={msg.status === 'open' ? 'default' : 'secondary'}>
                    {msg.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg text-sm">
                  {msg.message}
                </div>
                
                {msg.status === 'open' ? (
                  <div className="space-y-2">
                    <Textarea 
                      placeholder="Type your response here..."
                      value={responses[msg.id] || ""}
                      onChange={(e) => setResponses(prev => ({ ...prev, [msg.id]: e.target.value }))}
                    />
                    <Button onClick={() => handleSendResponse(msg.id)} className="w-full">
                      <Mail className="mr-2 h-4 w-4" /> Send Response & Close Ticket
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg text-sm italic">
                    <span className="font-bold not-italic block mb-1">Your Response:</span>
                    {msg.response}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminSupport;