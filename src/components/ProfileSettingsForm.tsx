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
import { User, Clock, Shield, CalendarRange, Timer, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const DAYS = [
  { id: "1", label: "Monday" },
  { id: "2", label: "Tuesday" },
  { id: "3", label: "Wednesday" },
  { id: "4", label: "Thursday" },
  { id: "5", label: "Friday" },
  { id: "6", label: "Saturday" },
  { id: "0", label: "Sunday" },
];

const formSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  hourly_rate: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0).nullable().optional()
  ),
  logo_url: z.string().url().optional().nullable().or(z.literal("")),
  default_lesson_duration: z.enum(["60", "90", "120"]).optional().nullable(),
  instructor_pin: z.string().optional().nullable(),
  min_booking_notice_hours: z.preprocess(
    (val) => (val === "" ? 48 : Number(val)),
    z.number().min(0)
  ),
  require_booking_approval: z.boolean().default(false),
  booking_mode: z.enum(["gaps", "open"]).default("gaps"),
  booking_interval_mins: z.preprocess(
    (val) => (val === "" ? 30 : Number(val)),
    z.number().min(15).max(120)
  ),
  booking_buffer_mins: z.preprocess(
    (val) => (val === "" ? 15 : Number(val)),
    z.number().min(0).max(60)
  ),
  working_hours: z.record(z.object({
    active: z.boolean(),
    start: z.number(),
    end: z.number()
  }))
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
      instructor_pin: "",
      min_booking_notice_hours: 48,
      require_booking_approval: false,
      booking_mode: "gaps",
      booking_interval_mins: 30,
      booking_buffer_mins: 15,
      working_hours: {
        "1": { active: true, start: 9, end: 17 },
        "2": { active: true, start: 9, end: 17 },
        "3": { active: true, start: 9, end: 17 },
        "4": { active: true, start: 9, end: 17 },
        "5": { active: true, start: 9, end: 17 },
        "6": { active: false, start: 9, end: 17 },
        "0": { active: false, start: 9, end: 17 },
      }
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
          instructor_pin: data.instructor_pin || "",
          min_booking_notice_hours: data.min_booking_notice_hours ?? 48,
          require_booking_approval: data.require_booking_approval ?? false,
          booking_mode: data.booking_mode || "gaps",
          booking_interval_mins: data.booking_interval_mins ?? 30,
          booking_buffer_mins: data.booking_buffer_mins ?? 15,
          working_hours: data.working_hours || form.getValues("working_hours")
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
        min_booking_notice_hours: values.min_booking_notice_hours,
        require_booking_approval: values.require_booking_approval,
        booking_mode: values.booking_mode,
        booking_interval_mins: values.booking_interval_mins,
        booking_buffer_mins: values.booking_buffer_mins,
        working_hours: values.working_hours,
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
  const bookingMode = form.watch("booking_mode");

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
                "p-3 rounded-lg font-mono text-xl sm:text-2xl tracking-[0.3em] sm:tracking-[0.5em] text-center border bg-background",
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

        <div className="p-4 border rounded-xl bg-muted/30 space-y-6">
          <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" /> Working Hours
          </h3>
          
          <div className="space-y-4">
            {DAYS.map((day) => (
              <div key={day.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-background rounded-lg border shadow-sm">
                <div className="flex items-center gap-3 min-w-[120px]">
                  <FormField
                    control={form.control}
                    name={`working_hours.${day.id}.active`}
                    render={({ field }) => (
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange} 
                        />
                      </FormControl>
                    )}
                  />
                  <span className={cn("font-bold text-sm", !form.watch(`working_hours.${day.id}.active`) && "text-muted-foreground")}>
                    {day.label}
                  </span>
                </div>

                {form.watch(`working_hours.${day.id}.active`) && (
                  <div className="flex items-center gap-2 animate-in fade-in duration-200">
                    <FormField
                      control={form.control}
                      name={`working_hours.${day.id}.start`}
                      render={({ field }) => (
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value.toString()}>
                          <FormControl><SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Array.from({ length: 24 }).map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <span className="text-xs font-bold text-muted-foreground">to</span>
                    <FormField
                      control={form.control}
                      name={`working_hours.${day.id}.end`}
                      render={({ field }) => (
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value.toString()}>
                          <FormControl><SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Array.from({ length: 24 }).map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                )}
                {!form.watch(`working_hours.${day.id}.active`) && (
                  <span className="text-xs italic text-muted-foreground">Unavailable</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border rounded-xl bg-muted/30 space-y-6">
          <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
            <CalendarRange className="h-4 w-4" /> Booking Preferences
          </h3>

          <FormField
            control={form.control}
            name="booking_mode"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Student Booking Mode</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="gaps" className="sr-only" />
                      </FormControl>
                      <FormLabel className={cn(
                        "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                        field.value === "gaps" && "border-primary"
                      )}>
                        <Clock className="mb-3 h-6 w-6" />
                        <span className="font-bold text-sm">Specific Gaps Only</span>
                        <span className="text-[10px] text-muted-foreground text-center mt-1">Students only see slots you manually mark as "Available"</span>
                      </FormLabel>
                    </FormItem>
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="open" className="sr-only" />
                      </FormControl>
                      <FormLabel className={cn(
                        "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                        field.value === "open" && "border-primary"
                      )}>
                        <CalendarRange className="mb-3 h-6 w-6" />
                        <span className="font-bold text-sm">Open Schedule</span>
                        <span className="text-[10px] text-muted-foreground text-center mt-1">Students can book any free time in your working day</span>
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {bookingMode === "open" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <FormField
                control={form.control}
                name="booking_interval_mins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Timer className="h-3 w-3" /> Start Intervals
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value.toString()}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="15">Every 15 mins</SelectItem>
                        <SelectItem value="30">Every 30 mins</SelectItem>
                        <SelectItem value="60">Every hour</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[10px]">How often a lesson can start.</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="booking_buffer_mins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-3 w-3" /> Travel Buffer
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value.toString()}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="0">No gap</SelectItem>
                        <SelectItem value="15">15 mins</SelectItem>
                        <SelectItem value="30">30 mins</SelectItem>
                        <SelectItem value="45">45 mins</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[10px]">Gap to leave between lessons.</FormDescription>
                  </FormItem>
                )}
              />
            </div>
          )}

          <div className="space-y-4 pt-4 border-t">
            <FormField
              control={form.control}
              name="require_booking_approval"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-background p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-bold">Require Approval</FormLabel>
                    <p className="text-[10px] text-muted-foreground">You must manually confirm every student booking.</p>
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
                  <FormDescription className="text-[10px]">Students cannot book lessons starting sooner than this.</FormDescription>
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" className="w-full font-bold">Save Changes</Button>
      </form>
    </Form>
  );
};

export default ProfileSettingsForm;