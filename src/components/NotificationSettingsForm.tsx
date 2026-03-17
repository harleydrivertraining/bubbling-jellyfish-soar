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
import { Mail, Send, Loader2, AlertTriangle, CalendarCheck, BellRing, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const formSchema = z.object({
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  email_notifications_enabled: z.boolean().default(true),
  sms_notifications_enabled: z.boolean().default(false),
  notif_lesson_booked: z.boolean().default(true),
  notif_lesson_booked_sms: z.boolean().default(false),
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
      sms_notifications_enabled: false,
      notif_lesson_booked: true,
      notif_lesson_booked_sms: false,
    },
  });

  const { isDirty } = form.formState;

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, email_notifications_enabled, sms_notifications_enabled, notif_lesson_booked, notif_lesson_booked_sms")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          email: data.email || "",
          email_notifications_enabled: data.email_notifications_enabled ?? true,
          sms_notifications_enabled: data.sms_notifications_enabled ?? false,
          notif_lesson_booked: data.notif_lesson_booked ?? true,
          notif_lesson_booked_sms: data.notif_lesson_booked_sms ?? false,
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
        sms_notifications_enabled: values.sms_notifications_enabled,
        notif_lesson_booked: values.notif_lesson_booked,
        notif_lesson_booked_sms: values.notif_lesson_booked_sms,
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" /> Email Configuration
            </CardTitle>
            <CardDescription>Where and how you receive automated alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <div className="space-y-0.5">
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
              <div className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="font-bold border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={handleTestEmail}
                  disabled={isTestingEmail}
                >
                  {isTestingEmail ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> Send Test Email</>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground italic">
                  Verifies your setup by sending a message to the email above.
                </p>
              </div>
              
              {isDirty && (
                <div className="flex items-center gap-2 text-xs font-bold text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                  <AlertTriangle className="h-3 w-3" />
                  <span>You have unsaved changes. Save before testing.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" /> SMS Configuration
            </CardTitle>
            <CardDescription>Enable text message alerts for your mobile device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="sms_notifications_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-muted/30 p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-bold">Master SMS Switch</FormLabel>
                    <FormDescription className="text-[10px]">Enable or disable all text alerts.</FormDescription>
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
            <p className="text-[10px] text-muted-foreground italic">
              Note: SMS notifications require a valid phone number in your <Link to="/settings" className="text-blue-500 underline">Profile Settings</Link>.
            </p>
          </CardContent>
        </Card>

        {(form.watch("email_notifications_enabled") || form.watch("sms_notifications_enabled")) && (
          <Card className="animate-in fade-in slide-in-from-top-2 duration-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" /> Alert Preferences
              </CardTitle>
              <CardDescription>Choose which events trigger a notification.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">New Lesson Bookings</h4>
                
                {form.watch("email_notifications_enabled") && (
                  <FormField
                    control={form.control}
                    name="notif_lesson_booked"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-blue-600" />
                          <FormLabel className="text-sm font-medium cursor-pointer">Email Alert</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {form.watch("sms_notifications_enabled") && (
                  <FormField
                    control={form.control}
                    name="notif_lesson_booked_sms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          <FormLabel className="text-sm font-medium cursor-pointer">SMS Alert</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full font-bold h-12 text-lg">Save Notification Settings</Button>
      </form>
    </Form>
  );
};

export default NotificationSettingsForm;