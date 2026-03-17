"use client";

import React from "react";
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
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { ShieldAlert } from "lucide-react";

const formSchema = z.object({
  subject: z.string().min(5, { message: "Subject must be at least 5 characters." }),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});

interface SupportMessageFormProps {
  onSuccess: () => void;
}

const SupportMessageForm: React.FC<SupportMessageFormProps> = ({ onSuccess }) => {
  const { user } = useSession();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    const { error } = await supabase
      .from("support_messages")
      .insert({
        user_id: user.id,
        subject: values.subject,
        message: values.message,
      });

    if (error) {
      showError("Failed to send message: " + error.message);
    } else {
      showSuccess("Support message sent to developers!");
      form.reset();
      onSuccess();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-xs mb-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <strong>Note:</strong> This request will be sent to the <strong>App Development Team</strong>. 
            Do not use this for lesson cancellations or contacting your instructor.
          </p>
        </div>

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input placeholder="e.g., App crashing on login, missing progress data" {...field} />
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
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please describe the technical issue in detail..." 
                  className="min-h-[120px]"
                  {...field} 
                />
              </FormControl>
              <FormDescription className="text-[10px]">
                Include steps to reproduce the issue if possible.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-bold">Send to App Developers</Button>
      </form>
    </Form>
  );
};

export default SupportMessageForm;