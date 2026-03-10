"use client";

import React, { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format, addMinutes, addWeeks } from "date-fns";
import { Plus, Minus } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import StudentSearch from "@/components/StudentSearch";

interface Student {
  id: string;
  name: string;
}

const formSchema = z.object({
  student_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lesson_type: z.enum(["Driving lesson", "Driving Test", "Personal"], {
    message: "Please select a valid lesson type.",
  }),
  lesson_length: z.enum(["60", "90", "120"], {
    message: "Please select a valid lesson length.",
  }),
  targets_for_next_session: z.string().optional().nullable(),
  repeat_booking: z.enum(["none", "weekly", "fortnightly"]),
  repeat_count: z.number().min(1).max(12).optional(),
  start_time: z.date({ required_error: "Start time is required." }),
}).superRefine((data, ctx) => {
  if (data.lesson_type !== "Personal" && !data.student_id) {
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      description: "",
      lesson_type: "Driving lesson",
      lesson_length: "60",
      targets_for_next_session: "",
      repeat_booking: "none",
      repeat_count: 1,
      start_time: initialStartTime,
    },
  });

  // Fetch user's default lesson duration
  useEffect(() => {
    const fetchDefaultDuration = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("default_lesson_duration")
        .eq("id", user.id)
        .single();

      if (!error && data?.default_lesson_duration) {
        form.setValue("lesson_length", data.default_lesson_duration as "60" | "90" | "120");
      }
    };

    fetchDefaultDuration();
  }, [user, form]);

  useEffect(() => {
    if (defaultValues?.lesson_type) {
      form.setValue("lesson_type", defaultValues.lesson_type);
    }
    if (defaultValues?.lesson_length) {
      form.setValue("lesson_length", defaultValues.lesson_length);
    }
    if (defaultValues?.student_id) {
      form.setValue("student_id", defaultValues.student_id);
    }
  }, [defaultValues, form]);

  const selectedLessonLength = form.watch("lesson_length");
  const selectedStartTime = form.watch("start_time");
  const selectedRepeatBooking = form.watch("repeat_booking");
  const selectedLessonType = form.watch("lesson_type");

  const [calculatedEndTime, setCalculatedEndTime] = useState<Date>(initialEndTime);

  useEffect(() => {
    if (selectedStartTime && selectedLessonLength) {
      const lengthInMinutes = parseInt(selectedLessonLength, 10);
      const newEndTime = addMinutes(selectedStartTime, lengthInMinutes);
      setCalculatedEndTime(newEndTime);
    }
  }, [selectedStartTime, selectedLessonLength]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return;
      setIsLoadingStudents(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("is_past_student", false)
        .order("name", { ascending: true });

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
    if (values.lesson_type !== "Personal" || values.student_id) {
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
        const lengthInMinutes = parseInt(values.lesson_length, 10);
        currentEndTime = addMinutes(currentStartTime, lengthInMinutes);
      }

      bookingsToInsert.push({
        user_id: user.id,
        student_id: values.student_id || null,
        title: generatedTitle,
        description: values.description,
        lesson_type: values.lesson_type,
        targets_for_next_session: values.targets_for_next_session,
        start_time: currentStartTime.toISOString(),
        end_time: currentEndTime.toISOString(),
        status: "scheduled",
      });
    }

    const { error } = await supabase
      .from("bookings")
      .insert(bookingsToInsert)
      .select();

    if (error) {
      console.error("Error adding booking(s):", error);
      showError("Failed to add booking(s): " + error.message);
    } else {
      showSuccess("Booking(s) added successfully!");
      form.reset();
      onBookingAdded();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="lesson_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lesson Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Driving lesson">Driving lesson</SelectItem>
                  <SelectItem value="Driving Test">Driving Test</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full">
            <FormField
              control={form.control}
              name="student_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Student {selectedLessonType === "Personal" && "(Opt)"}</FormLabel>
                  <FormControl>
                    <StudentSearch
                      value={field.value}
                      onChange={field.onChange}
                      students={students}
                      isLoading={isLoadingStudents}
                      placeholder={selectedLessonType === "Personal" ? "Optional student" : "Select student"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="w-full sm:w-[120px]">
            <FormField
              control={form.control}
              name="lesson_length"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Length</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="60">1 hr</SelectItem>
                      <SelectItem value="90">1.5 hrs</SelectItem>
                      <SelectItem value="120">2 hrs</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="start_time"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Time</FormLabel>
              <div className="flex gap-2">
                <DatePicker
                  date={field.value}
                  setDate={field.onChange}
                  placeholder="Select date"
                />
                <TimePicker
                  date={field.value}
                  onChange={field.onChange}
                  label="Start Time"
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem className="flex flex-col">
          <FormLabel>End Time</FormLabel>
          <Input
            type="text"
            value={format(calculatedEndTime, "PPP p")}
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
              <FormControl>
                <Textarea placeholder="e.g., dentist appointment, car service" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedLessonType !== "Personal" && (
          <FormField
            control={form.control}
            name="targets_for_next_session"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Targets for Next Session (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="e.g., practice parallel parking" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="repeat_booking"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repeat Booking</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select repeat option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedRepeatBooking !== "none" && (
            <FormField
              control={form.control}
              name="repeat_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Repeats</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3 h-10">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => field.onChange(Math.max(1, (field.value || 1) - 1))}
                        disabled={(field.value || 1) <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-bold text-lg">{field.value || 1}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => field.onChange(Math.min(12, (field.value || 1) + 1))}
                        disabled={(field.value || 1) >= 12}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}
            />
          )}
        </div>

        <Button type="submit" className="w-full">Add Booking</Button>
      </form>
    </Form>
  );
};

export default AddBookingForm;