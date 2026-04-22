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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Megaphone, Loader2, AlertTriangle, Users, UserCog, GraduationCap } from "lucide-react";

const formSchema = z.object({
  target: z.enum(["all", "instructors", "students"]),
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
      target: "all",
      title: "Platform Announcement",
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // 1. Build query based on target
      let query = supabase.from("profiles").select("id");
      
      if (values.target === "instructors") {
        query = query.eq("role", "instructor");
      } else if (values.target === "students") {
        query = query.eq("role", "student");
      }

      const { data: profiles, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (!profiles || profiles.length === 0) throw new Error(`No ${values.target} found to notify.`);

      // 2. Prepare bulk notifications
      const notifications = profiles.map(p => ({
        user_id: p.id,
        title: values.title,
        message: values.message,
        type: "broadcast",
        read: false
      }));

      // 3. Insert in batches of 100 to avoid payload limits
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("notifications")
          .insert(batch);
        
        if (insertError) throw insertError;
      }

      const targetLabel = values.target === 'all' ? 'all users' : values.target;
      showSuccess(`Broadcast sent to ${profiles.length} ${targetLabel}!`);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-bold">Important Notice</p>
            <p>This message will be sent as an in-app notification to the selected group. Use this only for critical updates or maintenance news.</p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="target"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-sm font-bold uppercase text-muted-foreground">Target Audience</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-1 gap-3"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <FormControl>
                      <RadioGroupItem value="all" />
                    </FormControl>
                    <Label className="font-bold flex items-center gap-2 cursor-pointer flex-1">
                      <Users className="h-4 w-4 text-primary" />
                      Everyone (Instructors & Students)
                    </Label>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <FormControl>
                      <RadioGroupItem value="instructors" />
                    </FormControl>
                    <Label className="font-bold flex items-center gap-2 cursor-pointer flex-1">
                      <UserCog className="h-4 w-4 text-blue-600" />
                      Instructors Only
                    </Label>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <FormControl>
                      <RadioGroupItem value="students" />
                    </FormControl>
                    <Label className="font-bold flex items-center gap-2 cursor-pointer flex-1">
                      <GraduationCap className="h-4 w-4 text-green-600" />
                      Students Only
                    </Label>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
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
        </div>

        <Button type="submit" className="w-full font-bold h-12" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending broadcast...
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