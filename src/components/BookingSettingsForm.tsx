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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Clock, CalendarRange, Timer, Shield, Loader2, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const DAYS = [
  { id: "1", label: "Monday" },
  { id: "2", label: "Tuesday" },
  { id: "3", label: "Wednesday" },
  { id: "4", label: "Thursday" },
  { id: "5", label: "Friday" },
  { id: "6", label: "Saturday" },
  { id: "0", label: "Sunday" },
];

const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      options.push(time);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const formSchema = z.object({
  min_booking_notice_hours: z.preprocess(
    (val) => (val === "" ? 48 : Number(val)),
    z.number().min(0)
  ),
  max_booking_advance_weeks: z.preprocess(
    (val) => (val === "" ? 12 : Number(val)),
    z.number().min(1).max(52)
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
    start: z.string(),
    end: z.string()
  }))
});

interface BookingSettingsFormProps {
  onSuccess: () => void;
}

const BookingSettingsForm: React.FC<BookingSettingsFormProps> = ({ onSuccess }) => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHoursExpanded, setIsHoursExpanded] = useState(false);
  const [instructorPin, setInstructorPin] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      min_booking_notice_hours: 48,
      max_booking_advance_weeks: 12,
      require_booking_approval: false,
      booking_mode: "gaps",
      booking_interval_mins: 30,
      booking_buffer_mins: 15,
      working_hours: {
        "1": { active: true, start: "09:00", end: "17:00" },
        "2": { active: true, start: "09:00", end: "17:00" },
        "3": { active: true, start: "09:00", end: "17:00" },
        "4": { active: true, start: "09:00", end: "17:00" },
        "5": { active: true, start: "09:00", end: "17:00" },
        "6": { active: false, start: "09:00", end: "17:00" },
        "0": { active: false, start: "09:00", end: "17:00" },
      }
    },
  });

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("min_booking_notice_hours, max_booking_advance_weeks, require_booking_approval, booking_mode, booking_interval_mins, booking_buffer_mins, instructor_pin, working_hours")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setInstructorPin(data.instructor_pin);
        
        const rawHours = data.working_hours || {};
        const formattedHours: any = {};
        DAYS.forEach(day => {
          const config = rawHours[day.id] || { active: false, start: "09:00", end: "17:00" };
          formattedHours[day.id] = {
            active: config.active,
            start: typeof config.start === 'number' ? `${config.start.toString().padStart(2, '0')}:00` : config.start,
            end: typeof config.end === 'number' ? `${config.end.toString().padStart(2, '0')}:00` : config.end,
          };
        });

        form.reset({
          min_booking_notice_hours: data.min_booking_notice_hours ?? 48,
          max_booking_advance_weeks: data.max_booking_advance_weeks ?? 12,
          require_booking_approval: data.require_booking_approval ?? false,
          booking_mode: (data.booking_mode as "gaps" | "open") || "gaps",
          booking_interval_mins: data.booking_interval_mins ?? 30,
          booking_buffer_mins: data.booking_buffer_mins ?? 15,
          working_hours: formattedHours
        });
      }
    } catch (error: any) {
      console.error("Error fetching booking settings:", error);
      showError("Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  }, [user, form]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    setIsSubmitting(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        min_booking_notice_hours: values.min_booking_notice_hours,
        max_booking_advance_weeks: values.max_booking_advance_weeks,
        require_booking_approval: values.require_booking_approval,
        booking_mode: values.booking_mode,
        booking_interval_mins: values.booking_interval_mins,
        booking_buffer_mins: values.booking_buffer_mins,
        working_hours: values.working_hours,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      showError("Failed to update settings: " + error.message);
    } else {
      showSuccess("Booking preferences updated!");
      onSuccess();
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const bookingMode = form.watch("booking_mode");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {instructorPin && (
          <div className="p-3 border rounded-lg bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase text-muted-foreground">Student Access PIN</span>
            </div>
            <span className="font-mono font-black tracking-widest text-primary">{instructorPin}</span>
          </div>
        )}

        <FormField
          control={form.control}
          name="booking_mode"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Booking Mode</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-1 gap-3"
                >
                  <FormItem>
                    <FormControl>
                      <RadioGroupItem value="gaps" className="sr-only" />
                    </FormControl>
                    <FormLabel className={cn(
                      "flex items-center gap-3 rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent cursor-pointer transition-all",
                      field.value === "gaps" && "border-primary bg-primary/5"
                    )}>
                      <Clock className={cn("h-5 w-5", field.value === "gaps" ? "text-primary" : "text-muted-foreground")} />
                      <div className="flex-1">
                        <p className="font-bold text-sm">Specific Gaps Only</p>
                        <p className="text-[10px] text-muted-foreground">Students only see slots you mark as "Available"</p>
                      </div>
                    </FormLabel>
                  </FormItem>
                  <FormItem>
                    <FormControl>
                      <RadioGroupItem value="open" className="sr-only" />
                    </FormControl>
                    <FormLabel className={cn(
                      "flex items-center gap-3 rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent cursor-pointer transition-all",
                      field.value === "open" && "border-primary bg-primary/5"
                    )}>
                      <CalendarRange className={cn("h-5 w-5", field.value === "open" ? "text-primary" : "text-muted-foreground")} />
                      <div className="flex-1">
                        <p className="font-bold text-sm">Open Schedule</p>
                        <p className="text-[10px] text-muted-foreground">Students can book any free time in your day</p>
                      </div>
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="min_booking_notice_hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Min Notice (Hrs)
                </FormLabel>
                <FormControl><Input type="number" className="h-9" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                <FormDescription className="text-[10px]">Minimum time before start</FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="max_booking_advance_weeks"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Max Advance (Wks)
                </FormLabel>
                <FormControl><Input type="number" className="h-9" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                <FormDescription className="text-[10px]">How far ahead they can see</FormDescription>
              </FormItem>
            )}
          />
        </div>

        {bookingMode === "open" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="booking_interval_mins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                      <Timer className="h-3 w-3" /> Intervals
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value.toString()}>
                      <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="15">15 mins</SelectItem>
                        <SelectItem value="30">30 mins</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="booking_buffer_mins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Buffer
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value.toString()}>
                      <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="15">15 mins</SelectItem>
                        <SelectItem value="30">30 mins</SelectItem>
                        <SelectItem value="45">45 mins</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <Collapsible open={isHoursExpanded} onOpenChange={setIsHoursExpanded} className="border rounded-xl bg-muted/30 overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase">Weekly Working Hours</span>
                  </div>
                  {isHoursExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-2 sm:p-4 pt-0 space-y-2 animate-in slide-in-from-top-2 duration-200">
                {DAYS.map((day) => (
                  <div key={day.id} className="grid grid-cols-[1fr_auto] items-center gap-4 p-3 bg-background rounded-lg border shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <FormField
                        control={form.control}
                        name={`working_hours.${day.id}.active`}
                        render={({ field }) => (
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                              className="scale-75 sm:scale-100"
                            />
                          </FormControl>
                        )}
                      />
                      <span className={cn("font-bold text-xs sm:text-sm truncate", !form.watch(`working_hours.${day.id}.active`) && "text-muted-foreground")}>
                        {day.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-end">
                      {form.watch(`working_hours.${day.id}.active`) ? (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <FormField
                            control={form.control}
                            name={`working_hours.${day.id}.start`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="w-[70px] sm:w-24 h-8 text-[10px] sm:text-xs px-2"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem key={time} value={time}>{time}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">to</span>
                          <FormField
                            control={form.control}
                            name={`working_hours.${day.id}.end`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="w-[70px] sm:w-24 h-8 text-[10px] sm:text-xs px-2"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {TIME_OPTIONS.map((time) => (
                                    <SelectItem key={time} value={time}>{time}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] sm:text-xs italic text-muted-foreground pr-2">Off</span>
                      )}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        <div className="space-y-4 pt-4 border-t">
          <FormField
            control={form.control}
            name="require_booking_approval"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-bold">Require Approval</FormLabel>
                  <p className="text-[10px] text-muted-foreground">Manually confirm every booking</p>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Booking Settings"}
        </Button>
      </form>
    </Form>
  );
};

export default BookingSettingsForm;