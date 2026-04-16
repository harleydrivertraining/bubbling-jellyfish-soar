"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Mail, Send, Loader2, AlertTriangle, CalendarCheck, BellRing } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const formSchema = z.object({
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  email_notifications_enabled: z.boolean().default(true),
  notif_lesson_booked: z.boolean().default(true),
});

const NotificationSettingsForm: React.FC = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      email_notifications_enabled: true,
      notif_lesson_booked: true,
    },
  });

  const { isDirty } = form.formState;

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, email_notifications_enabled, notif_lesson_booked")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          email: data.email || "",
          email_notifications_enabled: data.email_notifications_enabled ?? true,
          notif_lesson_booked: data.notif_lesson_booked ?? true,
        });
      }
    } catch (error: any) {
      console.error("Error fetching notification settings:", error);
      showError("Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  }, [user, form]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleTestEmail = async () => {
    if (!user) return;
    
    if (isDirty) {
      showError("You have unsaved changes. Please click 'Save Notification Settings' before sending a test email.");
      return;
    }

    const currentEmail = form.getValues("email");
    if (!currentEmail) {
      showError("Please enter and save an email address first.");
      return;
    }

    setIsTestingEmail(true);
    try {
      const { data, error } = await supabase.rpc('send_test_email', { 
        target_user_id: user.id 
      });

      if (error) throw new Error(error.message);

      if (data?.error) {
        showError("Database Error: " + data.error);
      } else {
        showSuccess("Test email sent! Please check your inbox.");
      }
    } catch (err: any) {
      console.error("Test email error:", err);
      showError("Failed to trigger test email: " + err.message);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        email: values.email,
        email_notifications_enabled: values.email_notifications_enabled,
        notif_lesson_booked: values.notif_lesson_booked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      showError("Failed to update settings: " + error.message);
    } else {
      showSuccess("Notification settings updated!");
      fetchSettings();
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" /> Email Configuration
            </CardTitle>
            <CardDescription>Where and how you receive automated alerts.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notification Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="your@email.com" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email_notifications_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-muted/30 p-3 shadow-sm">
                    <div className="space-y-0.5 pr-4">
                      <FormLabel className="text-xs">Master Email Switch</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="font-bold border-blue-200 text-blue-700 hover:bg-blue-100 w-full sm:w-auto"
                  onClick={handleTestEmail}
                  disabled={isTestingEmail}
                >
                  {isTestingEmail ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> Send Test Email</>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground italic text-center sm:text-left">
                  Verifies your setup by sending a message to the email above.
                </p>
              </div>
              
              {isDirty && (
                <div className="flex items-center gap-2 text-xs font-bold text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>You have unsaved changes. Save before testing.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {form.watch("email_notifications_enabled") && (
          <Card className="animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" /> Alert Preferences
              </CardTitle>
              <CardDescription>Choose which events trigger an email.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 grid grid-cols-1 gap-3">
              <FormField
                control={form.control}
                name="notif_lesson_booked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <CalendarCheck className="h-5 w-5 text-blue-600 shrink-0" />
                      <div className="space-y-0.5 min-w-0">
                        <FormLabel className="text-sm font-bold cursor-pointer truncate block">New Lesson Bookings</FormLabel>
                        <p className="text-[10px] text-muted-foreground truncate block">When a student books an available slot</p>
                      </div>
                    </div>
                    <FormControl className="shrink-0 ml-2">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full font-bold h-12 text-lg">Save Notification Settings</Button>
      </form>
    </Form>
  );
};

export default NotificationSettingsForm;