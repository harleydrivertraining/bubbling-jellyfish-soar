"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Megaphone, Loader2, AlertTriangle } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

interface GlobalBroadcastFormProps {
  onSuccess: () => void;
}

const GlobalBroadcastForm: React.FC<GlobalBroadcastFormProps> = ({ onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "Platform Announcement",
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // 1. Fetch all user IDs from profiles
      const { data: profiles, error: fetchError } = await supabase
        .from("profiles")
        .select("id");

      if (fetchError) throw fetchError;
      if (!profiles || profiles.length === 0) throw new Error("No users found to notify.");

      // 2. Prepare bulk notifications
      const notifications = profiles.map(p => ({
        user_id: p.id,
        title: values.title,
        message: values.message,
        type: "broadcast",
        read: false
      }));

      // 3. Insert in batches of 100 to avoid payload limits if the platform grows
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("notifications")
          .insert(batch);
        
        if (insertError) throw insertError;
      }

      showSuccess(`Broadcast sent to ${profiles.length} users!`);
      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error("Broadcast error:", error);
      showError(error.message || "Failed to send broadcast.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-bold">Important Notice</p>
            <p>This message will be sent as a notification to <strong>EVERY</strong> user on the platform. Use this only for critical updates or maintenance news.</p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notification Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Scheduled Maintenance" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message Content</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Type your global message here..." 
                  className="min-h-[120px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-bold h-12" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending to all users...
            </>
          ) : (
            <>
              <Megaphone className="mr-2 h-4 w-4" />
              Send Global Broadcast
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};

export default GlobalBroadcastForm;