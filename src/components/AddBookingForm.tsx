"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format, addMinutes, addWeeks, differenceInMinutes, isValid } from "date-fns";
import { Plus, Minus, Sparkles, Repeat, X } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import StudentSearch from "@/components/StudentSearch";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
}

const formSchema = z.object({
  student_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lesson_type: z.enum(["Driving lesson", "Driving Test", "Personal", "Availability"], {
    message: "Please select a valid lesson type.",
  }),
  lesson_length: z.string().min(1, "Length is required"),
  targets_for_next_session: z.string().optional().nullable(),
  repeat_booking: z.enum(["none", "weekly", "fortnightly"]),
  repeat_count: z.number().min(1).max(12).optional(),
  start_time: z.date({ required_error: "Start time is required." }),
}).superRefine((data, ctx) => {
  if (data.lesson_type !== "Personal" && data.lesson_type !== "Availability" && !data.student_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select a student for this lesson type.",
      path: ["student_id"],
    });
  }
});

interface AddBookingFormProps {
  initialStartTime: Date;
  initialEndTime: Date;
  onBookingAdded: () => void;
  onClose: () => void;
  defaultValues?: Partial<z.infer<typeof formSchema>>;
}

const AddBookingForm: React.FC<AddBookingFormProps> = ({
  initialStartTime,
  initialEndTime,
  onBookingAdded,
  onClose,
  defaultValues,
}) => {
  const { user } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isCustomLength, setIsCustomLength] = useState(false);

  const initialDuration = useMemo(() => {
    const diff = differenceInMinutes(initialEndTime, initialStartTime);
    return diff.toString();
  }, [initialStartTime, initialEndTime]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      description: "",
      lesson_type: "Driving lesson",
      lesson_length: initialDuration,
      targets_for_next_session: "",
      repeat_booking: "none",
      repeat_count: 1,
      start_time: initialStartTime,
    },
  });

  useEffect(() => {
    const fetchDefaultDuration = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("default_lesson_duration")
        .eq("id", user.id)
        .single();

      if (!error && data?.default_lesson_duration) {
        if (form.getValues("lesson_type") !== "Driving Test" && !defaultValues?.lesson_length) {
          form.setValue("lesson_length", data.default_lesson_duration);
        }
      }
    };
    fetchDefaultDuration();
  }, [user, form, defaultValues]);

  useEffect(() => {
    if (defaultValues?.lesson_type) form.setValue("lesson_type", defaultValues.lesson_type);
    if (defaultValues?.lesson_length) form.setValue("lesson_length", defaultValues.lesson_length);
    if (defaultValues?.student_id) form.setValue("student_id", defaultValues.student_id);
  }, [defaultValues, form]);

  const selectedLessonLength = form.watch("lesson_length");
  const selectedStartTime = form.watch("start_time");
  const selectedRepeatBooking = form.watch("repeat_booking");
  const selectedLessonType = form.watch("lesson_type");

  useEffect(() => {
    if (selectedLessonType === "Driving Test") {
      form.setValue("lesson_length", "120");
      setIsCustomLength(false);
    }
  }, [selectedLessonType, form]);

  const calculatedEndTime = useMemo(() => {
    const length = parseInt(selectedLessonLength, 10);
    if (!selectedStartTime || isNaN(length)) return selectedStartTime || new Date();
    return addMinutes(selectedStartTime, length);
  }, [selectedStartTime, selectedLessonLength]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return;
      setIsLoadingStudents(true);
      const { data, error } = await supabase.from("students").select("id, name").eq("user_id", user.id).eq("is_past_student", false).order("name", { ascending: true });
      if (error) {
        console.error("Error fetching students:", error);
        showError("Failed to load students: " + error.message);
        setStudents([]);
      } else {
        setStudents(data || []);
      }
      setIsLoadingStudents(false);
    };
    fetchStudents();
  }, [user]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to add a booking.");
      return;
    }

    let generatedTitle = "Personal Appointment";
    let status = "scheduled";

    if (values.lesson_type === "Availability") {
      generatedTitle = "Available Slot";
      status = "available";
    } else if (values.lesson_type !== "Personal" || values.student_id) {
      const studentName = students.find(s => s.id === values.student_id)?.name || "Unknown Student";
      generatedTitle = `${studentName} - ${values.lesson_type}`;
    }

    const bookingsToInsert = [];
    const numRepeats = values.repeat_booking !== "none" ? (values.repeat_count || 1) : 1;
    const interval = values.repeat_booking === "weekly" ? 1 : 2;

    for (let i = 0; i < numRepeats; i++) {
      let currentStartTime = values.start_time;
      let currentEndTime = calculatedEndTime;
      if (i > 0 && values.repeat_booking !== "none") {
        currentStartTime = addWeeks(values.start_time, i * interval);
        currentEndTime = addMinutes(currentStartTime, parseInt(values.lesson_length, 10) || 0);
      }
      bookingsToInsert.push({ user_id: user.id, student_id: values.student_id || null, title: generatedTitle, description: values.description, lesson_type: values.lesson_type, targets_for_next_session: values.targets_for_next_session, start_time: currentStartTime.toISOString(), end_time: currentEndTime.toISOString(), status: status });
    }

    const { error } = await supabase.from("bookings").insert(bookingsToInsert).select();
    if (error) {
      console.error("Error adding booking(s):", error);
      showError("Failed to add booking(s): " + error.message);
    } else {
      showSuccess(values.lesson_type === "Availability" ? "Availability slot created!" : "Booking(s) added successfully!");
      form.reset();
      onBookingAdded();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-6">
        <FormField
          control={form.control}
          name="lesson_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lesson Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Driving lesson">Driving lesson</SelectItem>
                  <SelectItem value="Driving Test">Driving Test</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Availability" className="text-blue-600 font-bold"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Availability Slot</div></SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedLessonType !== "Availability" && (
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1 w-full">
              <FormField
                control={form.control}
                name="student_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Student {selectedLessonType === "Personal" && "(Opt)"}</FormLabel>
                    <FormControl><StudentSearch value={field.value} onChange={field.onChange} students={students} isLoading={isLoadingStudents} placeholder={selectedLessonType === "Personal" ? "Optional student" : "Select student"} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="w-full sm:w-[180px]">
              <FormField
                control={form.control}
                name="lesson_length"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Length</FormLabel>
                    {isCustomLength ? (
                      <div className="flex items-center gap-1">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          className="h-10 w-10 shrink-0"
                          onClick={() => {
                            const current = parseInt(field.value, 10) || 0;
                            field.onChange(Math.max(15, current - 30).toString());
                          }}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input 
                          type="number" 
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="h-10 font-bold text-center" 
                          placeholder="Mins"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          className="h-10 w-10 shrink-0"
                          onClick={() => {
                            const current = parseInt(field.value, 10) || 0;
                            field.onChange((current + 30).toString());
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setIsCustomLength(false)}
                          className="h-10 w-10 shrink-0 ml-1"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Select 
                        onValueChange={(val) => {
                          if (val === "custom") setIsCustomLength(true);
                          else {
                            setIsCustomLength(false);
                            field.onChange(val);
                          }
                        }} 
                        value={isCustomLength ? "custom" : field.value}
                      >
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="60">1 hr</SelectItem>
                          <SelectItem value="90">1.5 hrs</SelectItem>
                          <SelectItem value="120">2 hrs</SelectItem>
                          <SelectItem value="custom" className="font-bold text-primary">Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="start_time"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Time</FormLabel>
              <div className="flex gap-2">
                <DatePicker date={field.value} setDate={field.onChange} placeholder="Select date" />
                <TimePicker date={field.value} onChange={field.onChange} label="Start Time" />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem className="flex flex-col">
          <FormLabel>End Time</FormLabel>
          <Input 
            type="text" 
            value={isValid(calculatedEndTime) ? format(calculatedEndTime, "PPP p") : "Invalid time"} 
            readOnly 
            className="bg-muted" 
          />
        </FormItem>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl><Textarea placeholder="e.g., dentist appointment" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedLessonType !== "Personal" && selectedLessonType !== "Availability" && (
          <FormField
            control={form.control}
            name="targets_for_next_session"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Targets for Next Session (Optional)</FormLabel>
                <FormControl><Textarea placeholder="e.g., practice parallel parking" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
          <FormField
            control={form.control}
            name="repeat_booking"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" /> Repeat Booking</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                    <FormItem><FormControl><RadioGroupItem value="none" className="sr-only" /></FormControl><FormLabel className={cn("flex items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent cursor-pointer text-xs font-bold transition-all", field.value === "none" && "border-primary bg-primary/5")}>None</FormLabel></FormItem>
                    <FormItem><FormControl><RadioGroupItem value="weekly" className="sr-only" /></FormControl><FormLabel className={cn("flex items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent cursor-pointer text-xs font-bold transition-all", field.value === "weekly" && "border-primary bg-primary/5")}>Weekly</FormLabel></FormItem>
                    <FormItem><FormControl><RadioGroupItem value="fortnightly" className="sr-only" /></FormControl><FormLabel className={cn("flex items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent cursor-pointer text-xs font-bold transition-all", field.value === "fortnightly" && "border-primary bg-primary/5")}>Fortnightly</FormLabel></FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {selectedRepeatBooking !== "none" && (
            <FormField
              control={form.control}
              name="repeat_count"
              render={({ field }) => (
                <FormItem className="animate-in slide-in-from-top-2 duration-200">
                  <FormLabel>Number of Repeats</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3 h-10">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => field.onChange(Math.max(1, (field.value || 1) - 1))} disabled={(field.value || 1) <= 1}><Minus className="h-4 w-4" /></Button>
                      <span className="w-8 text-center font-bold text-lg">{field.value || 1}</span>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => field.onChange(Math.min(12, (field.value || 1) + 1))} disabled={(field.value || 1) >= 12}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        <Button type="submit" className="w-full font-black h-12 text-lg">{selectedLessonType === "Availability" ? "Create Availability Slot" : "Add Booking"}</Button>
      </form>
    </Form>
  );
};

export default AddBookingForm;