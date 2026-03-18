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
import { User, Clock, Shield, BellRing, CheckSquare, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  hourly_rate: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0).nullable().optional()
  ),
  logo_url: z.string().url().optional().nullable().or(z.literal("")),
  default_lesson_duration: z.enum(["60", "90", "120"]).optional().nullable(),
  calendar_start_hour: z.string().optional().nullable(),
  calendar_end_hour: z.string().optional().nullable(),
  instructor_pin: z.string().optional().nullable(),
  min_booking_notice_hours: z.preprocess(
    (val) => (val === "" ? 48 : Number(val)),
    z.number().min(0)
  ),
  require_booking_approval: z.boolean().default(false),
});

const ProfileSettingsForm: React.FC = () => {
  const { user } = useSession();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      hourly_rate: null,
      logo_url: "",
      default_lesson_duration: "60",
      calendar_start_hour: "9",
      calendar_end_hour: "18",
      instructor_pin: "",
      min_booking_notice_hours: 48,
      require_booking_approval: false,
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
        setUserRole(data.role);
        form.reset({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          hourly_rate: data.hourly_rate,
          logo_url: data.logo_url || "",
          default_lesson_duration: (data.default_lesson_duration as "60" | "90" | "120") || "60",
          calendar_start_hour: data.calendar_start_hour?.toString() || "9",
          calendar_end_hour: data.calendar_end_hour?.toString() || "18",
          instructor_pin: data.instructor_pin || "",
          min_booking_notice_hours: data.min_booking_notice_hours ?? 48,
          require_booking_approval: data.require_booking_approval ?? false,
        });
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [user, form]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        hourly_rate: values.hourly_rate,
        logo_url: values.logo_url === "" ? null : values.logo_url,
        default_lesson_duration: values.default_lesson_duration,
        calendar_start_hour: values.calendar_start_hour ? parseInt(values.calendar_start_hour) : 9,
        calendar_end_hour: values.calendar_end_hour ? parseInt(values.calendar_end_hour) : 18,
        min_booking_notice_hours: values.min_booking_notice_hours,
        require_booking_approval: values.require_booking_approval,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      showError("Failed to update profile: " + error.message);
    } else {
      showSuccess("Profile updated successfully!");
      fetchProfile();
    }
  };

  if (isLoadingProfile) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  }

  const isStudent = userRole === 'student';
  const pinValue = form.watch("instructor_pin");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={form.watch("logo_url") || undefined} />
            <AvatarFallback><User className="h-8 w-8 text-muted-foreground" /></AvatarFallback>
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

        {!isStudent && (
          <div className="p-4 border rounded-xl bg-primary/5 space-y-3">
            <h3 className="text-sm font-bold uppercase text-primary flex items-center gap-2">
              <Shield className="h-4 w-4" /> Instructor Access PIN
            </h3>
            <div className="space-y-1">
              <div className={cn(
                "p-3 rounded-lg font-mono text-2xl tracking-[0.5em] text-center border bg-background",
                !pinValue && "text-destructive border-destructive/20 bg-destructive/5"
              )}>
                {pinValue || "NOT ASSIGNED"}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Give this PIN to your students so they can sign in.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
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
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
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
                <FormLabel>Hourly Rate (£)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} value={field.value === null ? "" : field.value} onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))} />
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
                <FormLabel>Default Duration</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || "60"}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
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
            name="require_booking_approval"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-background p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-bold">Require Approval</FormLabel>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="min_booking_notice_hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notice Period (Hours)</FormLabel>
                <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full font-bold">Save Changes</Button>
      </form>
    </Form>
  );
};

export default ProfileSettingsForm;