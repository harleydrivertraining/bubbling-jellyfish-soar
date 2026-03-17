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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Clock, Shield, RefreshCw, BellRing, Mail, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { sendBookingNotificationEmail } from "@/utils/email";

const formSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().email({ message: "Please enter a valid email address." }).optional().nullable().or(z.literal("")),
  hourly_rate: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0, { message: "Hourly rate cannot be negative." }).nullable().optional()
  ),
  logo_url: z.string().url({ message: "Must be a valid URL." }).optional().nullable().or(z.literal("")),
  default_lesson_duration: z.enum(["60", "90", "120"]).optional().nullable(),
  calendar_start_hour: z.string().optional().nullable(),
  calendar_end_hour: z.string().optional().nullable(),
  instructor_pin: z.string().optional().nullable(),
  min_booking_notice_hours: z.preprocess(
    (val) => (val === "" ? 48 : Number(val)),
    z.number().min(0, { message: "Notice period cannot be negative." })
  ),
  email_notifications_enabled: z.boolean().default(true),
});

const ProfileSettingsForm: React.FC<{ onProfileUpdated?: () => void }> = ({ onProfileUpdated }) => {
  const { user } = useSession();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      hourly_rate: null,
      logo_url: "",
      default_lesson_duration: "60",
      calendar_start_hour: "9",
      calendar_end_hour: "18",
      instructor_pin: "",
      min_booking_notice_hours: 48,
      email_notifications_enabled: true,
    },
  });

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setIsLoadingProfile(true);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || user.email || "",
          hourly_rate: data.hourly_rate,
          logo_url: data.logo_url || "",
          default_lesson_duration: (data.default_lesson_duration as "60" | "90" | "120") || "60",
          calendar_start_hour: data.calendar_start_hour?.toString() || "9",
          calendar_end_hour: data.calendar_end_hour?.toString() || "18",
          instructor_pin: data.instructor_pin || "",
          min_booking_notice_hours: data.min_booking_notice_hours ?? 48,
          email_notifications_enabled: data.email_notifications_enabled ?? true,
        });
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      showError("Failed to load profile.");
    } finally {
      setIsLoadingProfile(false);
    }
  }, [user, form]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSendTestEmail = async () => {
    const email = form.getValues("email");
    if (!email) {
      showError("Please enter and save an email address first.");
      return;
    }

    setIsSendingTest(true);
    try {
      await sendBookingNotificationEmail({
        to: email,
        studentName: "Test Student (Verification)",
        startTime: new Date(),
        endTime: new Date(new Date().getTime() + 60 * 60000)
      });
      showSuccess("Test email request sent! Check your Resend dashboard or inbox.");
    } catch (error: any) {
      showError("Failed to send test email. Check your Resend API key in .env");
    } finally {
      setIsSendingTest(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        hourly_rate: values.hourly_rate,
        logo_url: values.logo_url === "" ? null : values.logo_url,
        default_lesson_duration: values.default_lesson_duration,
        calendar_start_hour: values.calendar_start_hour ? parseInt(values.calendar_start_hour) : 9,
        calendar_end_hour: values.calendar_end_hour ? parseInt(values.calendar_end_hour) : 18,
        min_booking_notice_hours: values.min_booking_notice_hours,
        email_notifications_enabled: values.email_notifications_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      showError("Failed to update profile: " + error.message);
    } else {
      showSuccess("Profile updated successfully!");
      fetchProfile();
      if (onProfileUpdated) onProfileUpdated();
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => ({
    label: `${i.toString().padStart(2, '0')}:00`,
    value: i.toString()
  }));

  if (isLoadingProfile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={form.watch("logo_url") || undefined} alt="Logo" />
            <AvatarFallback><UserIcon className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
          </Avatar>
          <FormField
            control={form.control}
            name="logo_url"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Logo URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/logo.png" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="p-4 border rounded-xl bg-primary/5 space-y-4">
          <h3 className="text-sm font-bold uppercase text-primary flex items-center gap-2">
            <Shield className="h-4 w-4" /> Assigned Instructor PIN
          </h3>
          <FormField
            control={form.control}
            name="instructor_pin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your Unique 4-Digit PIN</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    value={field.value || ""} 
                    readOnly 
                    className="font-mono text-lg tracking-widest bg-muted cursor-not-allowed"
                  />
                </FormControl>
                <FormDescription>Give this to your students so they can link their account to you.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notification Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="your@email.com" className="pl-10" {...field} value={field.value || ""} />
                </div>
              </FormControl>
              <FormDescription>Where you will receive booking alerts.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="p-4 border rounded-xl bg-blue-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase text-blue-700 flex items-center gap-2">
              <BellRing className="h-4 w-4" /> Email Notifications
            </h3>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-8 text-[10px] font-bold uppercase border-blue-200 text-blue-700 hover:bg-blue-100"
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
            >
              {isSendingTest ? "Sending..." : <><Send className="mr-1.5 h-3 w-3" /> Send Test Email</>}
            </Button>
          </div>
          <FormField
            control={form.control}
            name="email_notifications_enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-white shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Booking Alerts</FormLabel>
                  <FormDescription className="text-[10px]">
                    Receive an email whenever a student books an available slot.
                  </FormDescription>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hourly_rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hourly Lesson Rate (£)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    value={field.value === null ? "" : field.value}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="default_lesson_duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Lesson Duration</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || "60"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select default" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
          <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
            <BellRing className="h-4 w-4" /> Booking Restrictions
          </h3>
          <FormField
            control={form.control}
            name="min_booking_notice_hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Booking Notice (Hours)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" /> Calendar Display Hours
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="calendar_start_hour"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Hour</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "9"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hours.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="calendar_end_hour"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Hour</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "18"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hours.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" className="w-full">Save Changes</Button>
      </form>
    </Form>
  );
};

export default ProfileSettingsForm;