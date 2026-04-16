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
import { Clock, CalendarRange, Timer, Shield, Loader2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const formSchema = z.object({
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
});

interface BookingSettingsFormProps {
  onSuccess: () => void;
}

const BookingSettingsForm: React.FC<BookingSettingsFormProps> = ({ onSuccess }) => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [instructorPin, setInstructorPin] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      min_booking_notice_hours: 48,
      require_booking_approval: false,
      booking_mode: "gaps",
      booking_interval_mins: 30,
      booking_buffer_mins: 15,
    },
  });

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setFetchError(null);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("min_booking_notice_hours, require_booking_approval, booking_mode, booking_interval_mins, booking_buffer_mins, instructor_pin")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setInstructorPin(data.instructor_pin);
        form.reset({
          min_booking_notice_hours: data.min_booking_notice_hours ?? 48,
          require_booking_approval: data.require_booking_approval ?? false,
          booking_mode: (data.booking_mode as "gaps" | "open") || "gaps",
          booking_interval_mins: data.booking_interval_mins ?? 30,
          booking_buffer_mins: data.booking_buffer_mins ?? 15,
        });
      }
    } catch (error: any) {
      console.error("Error fetching booking settings:", error);
      setFetchError(error.message);
      showError("Failed to load settings. Please ensure database columns are added.");
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
        require_booking_approval: values.require_booking_approval,
        booking_mode: values.booking_mode,
        booking_interval_mins: values.booking_interval_mins,
        booking_buffer_mins: values.booking_buffer_mins,
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

  if (fetchError) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <div className="space-y-2">
          <p className="font-bold text-lg">Database Error</p>
          <p className="text-sm text-muted-foreground">
            It looks like the new booking columns haven't been added to your database yet.
          </p>
        </div>
        <div className="p-3 bg-muted rounded text-[10px] font-mono text-left overflow-auto max-h-32">
          {fetchError}
        </div>
        <Button onClick={fetchSettings} variant="outline" className="w-full">
          Try Again
        </Button>
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

        {bookingMode === "open" && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
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
          <FormField
            control={form.control}
            name="min_booking_notice_hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold">Notice Period (Hours)</FormLabel>
                <FormControl><Input type="number" className="h-9" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                <FormDescription className="text-[10px]">Minimum time before a lesson starts</FormDescription>
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