"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { 
  Send, 
  Users, 
  User, 
  Megaphone, 
  MessageSquare, 
  Clock, 
  Search,
  CheckCircle2,
  Inbox,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import MessageConversation from "@/components/MessageConversation";

interface Student {
  id: string;
  name: string;
  auth_user_id: string | null;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  is_broadcast: boolean;
  student_id: string | null;
  instructor_id: string;
  students?: {
    name: string;
  };
}

const InstructorMessages: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  
  // Form State
  const [messageContent, setMessageContent] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]); // Empty means "All" if broadcast is checked
  const [isBroadcast, setIsBroadcast] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const [studentsRes, messagesRes] = await Promise.all([
        supabase.from("students").select("id, name, auth_user_id").eq("user_id", user.id).eq("is_past_student", false).order("name", { ascending: true }),
        supabase.from("instructor_messages").select("*, students(name)").eq("instructor_id", user.id).order("created_at", { ascending: false })
      ]);

      if (studentsRes.error) throw studentsRes.error;
      setStudents(studentsRes.data || []);
      setMessages(messagesRes.data || []);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      showError("Failed to load messaging data.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchData();
  }, [isSessionLoading, fetchData]);

  const handleSendMessage = async () => {
    if (!user || !messageContent.trim()) return;
    if (!isBroadcast && selectedStudentIds.length === 0) {
      showError("Please select at least one student or choose 'Broadcast to All'.");
      return;
    }

    setIsSending(true);
    try {
      const messagesToInsert = [];

      if (isBroadcast) {
        messagesToInsert.push({
          instructor_id: user.id,
          content: messageContent.trim(),
          is_broadcast: true,
          student_id: null
        });

        // Notify all students with an account
        const studentsWithAccounts = students.filter(s => s.auth_user_id);
        if (studentsWithAccounts.length > 0) {
          await supabase.from("notifications").insert(
            studentsWithAccounts.map(s => ({
              user_id: s.auth_user_id,
              title: "New Announcement",
              message: "Your instructor has posted a new announcement.",
              type: "instructor_message"
            }))
          );
        }
      } else {
        selectedStudentIds.forEach(id => {
          messagesToInsert.push({
            instructor_id: user.id,
            content: messageContent.trim(),
            is_broadcast: false,
            student_id: id
          });
        });

        // Notify specific students
        const targetStudents = students.filter(s => selectedStudentIds.includes(s.id) && s.auth_user_id);
        if (targetStudents.length > 0) {
          await supabase.from("notifications").insert(
            targetStudents.map(s => ({
              user_id: s.auth_user_id,
              title: "New Message",
              message: "Your instructor has sent you a private message.",
              type: "instructor_message"
            }))
          );
        }
      }

      const { error } = await supabase.from("instructor_messages").insert(messagesToInsert);
      if (error) throw error;

      showSuccess("Message sent successfully!");
      setMessageContent("");
      setSelectedStudentIds([]);
      fetchData();
    } catch (error: any) {
      showError("Failed to send message: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6 p-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-6 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Student Messaging</h1>
          <p className="text-muted-foreground font-medium">Send announcements or private messages to your learners.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Compose Section */}
        <Card className="lg:col-span-1 shadow-md border-none">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" /> Compose Message
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Megaphone className={cn("h-4 w-4", isBroadcast ? "text-primary" : "text-muted-foreground")} />
                  <Label htmlFor="broadcast" className="font-bold text-sm cursor-pointer">Broadcast to All</Label>
                </div>
                <Checkbox 
                  id="broadcast" 
                  checked={isBroadcast} 
                  onCheckedChange={(val) => setIsBroadcast(!!val)} 
                />
              </div>

              {!isBroadcast && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Select Recipients</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search students..." 
                      className="pl-8 h-9 text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[200px] border rounded-lg p-2 bg-muted/20">
                    <div className="space-y-1">
                      {filteredStudents.map(student => (
                        <div 
                          key={student.id} 
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer hover:bg-muted",
                            selectedStudentIds.includes(student.id) && "bg-primary/5"
                          )}
                          onClick={() => toggleStudent(student.id)}
                        >
                          <Checkbox 
                            checked={selectedStudentIds.includes(student.id)} 
                            onCheckedChange={() => toggleStudent(student.id)}
                          />
                          <span className="text-sm font-medium">{student.name}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {selectedStudentIds.length} student(s) selected
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Message Content</Label>
                <Textarea 
                  placeholder="Type your message here..." 
                  className="min-h-[150px] resize-none"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                />
              </div>

              <Button 
                className="w-full font-bold h-12" 
                onClick={handleSendMessage}
                disabled={isSending || !messageContent.trim()}
              >
                {isSending ? "Sending..." : <><Send className="mr-2 h-4 w-4" /> Send Message</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History Section */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" /> Sent History
            </CardTitle>
            <CardDescription>Review your previous communications and student replies.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {messages.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic">
                No messages sent yet.
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="divide-y">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-6 space-y-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {msg.is_broadcast ? (
                            <Badge className="bg-primary text-primary-foreground font-bold text-[10px] uppercase">
                              <Megaphone className="mr-1 h-3 w-3" /> Broadcast
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-bold text-[10px] uppercase border-blue-200 text-blue-700 bg-blue-50">
                              <User className="mr-1 h-3 w-3" /> {msg.students?.name || "Private"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(msg.created_at), "MMM d, p")}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl text-sm text-foreground border border-muted">
                        {msg.content}
                      </div>

                      {/* Conversation View */}
                      <div className="pt-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                          className="text-[10px] font-bold uppercase h-7 px-2"
                        >
                          {expandedMessageId === msg.id ? <>Hide Conversation <ChevronUp className="ml-1 h-3 w-3" /></> : <>View Conversation <ChevronDown className="ml-1 h-3 w-3" /></>}
                        </Button>
                        
                        {expandedMessageId === msg.id && (
                          <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                            <MessageConversation 
                              messageId={msg.id} 
                              instructorId={msg.instructor_id}
                              studentId={msg.student_id}
                              isBroadcast={msg.is_broadcast}
                            />
                          </div>
                        )}
                      </div>
                    </div>
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

export default InstructorMessages;