"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, X, Bot, User, Loader2, Command } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { processAICommand } from "@/utils/ai-logic";
import { cn } from "@/lib/utils";

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

const AIAssistant: React.FC = () => {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Hi! I'm your Instructor Assistant. I can help you book lessons, add expenses, or update student progress. What can I do for you?", 
      timestamp: new Date() 
    }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || !user || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsProcessing(true);

    try {
      const response = await processAICommand(userMessage, user.id);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.message, 
        timestamp: new Date() 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I ran into an error processing that request.", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-[100] flex flex-col items-end">
      {isOpen && (
        <Card className="w-[320px] sm:w-[380px] h-[450px] mb-4 shadow-2xl border-primary/20 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="bg-primary text-primary-foreground p-4 rounded-t-xl flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-tight">Instructor Assistant</CardTitle>
                <p className="text-[10px] opacity-70 font-bold">AI POWERED</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-muted/5">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex gap-2 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}>
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center shrink-0 border shadow-sm",
                      msg.role === 'assistant' ? "bg-primary text-primary-foreground" : "bg-background"
                    )}>
                      {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                      msg.role === 'assistant' ? "bg-white border" : "bg-primary text-primary-foreground"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex gap-2 mr-auto">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="bg-white border p-3 rounded-2xl text-xs italic text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t bg-background">
              <div className="flex gap-2">
                <Input 
                  placeholder="Ask me anything..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="text-xs h-10 bg-muted/30 border-none focus-visible:ring-1"
                />
                <Button size="icon" onClick={handleSend} disabled={!input.trim() || isProcessing} className="h-10 w-10 shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5 mt-2 px-1">
                <Command className="h-3 w-3 text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground font-medium">Try: "Add £20 fuel expense"</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button 
        size="icon" 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-full shadow-xl border-4 border-white transition-all duration-300",
          isOpen ? "bg-destructive hover:bg-destructive/90 rotate-90" : "bg-primary hover:bg-primary/90"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </Button>
    </div>
  );
};

export default AIAssistant;