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
import { Plus, Minus, Sparkles } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import StudentSearch from "@/components/StudentSearch";
import { sendBookingEmail } from "@/utils/email";

interface Student {
  id: string;
  name: string;
  email?: string;
}

const formSchema = z.object({
  student_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lesson_type: z.enum(["Driving lesson", "Driving Test", "Personal", "Availability"], {
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
  const [instructorName, setInstructorName] = useState("");

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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single();
      if (data) setInstructorName(`${data.first_name} ${data.last_name}`);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return;
      setIsLoadingStudents(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, name, email")
        .eq("user_id", user.id)
        .eq("is_past_student", false)
        .order("name", { ascending: true });

      if (!error) setStudents(data || []);
      setIsLoadingStudents(false);
    };
    fetchStudents();
  }, [user]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    let generatedTitle = "Personal Appointment";
    let status = "scheduled";

    if (values.lesson_type === "Availability") {
      generatedTitle = "Available Slot";
      status = "available";
    } else if (values.lesson_type !== "Personal" || values.student_id) {
      const student = students.find(s => s.id === values.student_id);
      generatedTitle = `${student?.name || "Unknown"} - ${values.lesson_type}`;
    }

    const bookingsToInsert = [];
    const numRepeats = values.repeat_booking !== "none" ? (values.repeat_count || 1) : 1;
    const interval = values.repeat_booking === "weekly" ? 1 : 2;

    for (let i = 0; i < numRepeats; i++) {
      let currentStartTime = addWeeks(values.start_time, i * (values.repeat_booking === "none" ? 0 : interval));
      let currentEndTime = addMinutes(currentStartTime, parseInt(values.lesson_length, 10));

      bookingsToInsert.push({
        user_id: user.id,
        student_id: values.student_id || null,
        title: generatedTitle,
        description: values.description,
        lesson_type: values.lesson_type,
        targets_for_next_session: values.targets_for_next_session,
        start_time: currentStartTime.toISOString(),
        end_time: currentEndTime.toISOString(),
        status: status,
      });
    }

    const { error } = await supabase.from("bookings").insert(bookingsToInsert);

    if (error) {
      showError("Failed to add booking: " + error.message);
    } else {
      showSuccess("Booking added!");
      
      // Send email to student if they have an email address
      if (values.student_id && values.lesson_type !== "Availability") {
        const student = students.find(s => s.id === values.student_id);
        if (student?.email) {
          sendBookingEmail({
            to: student.email,
            subject: `New Driving Lesson Scheduled: ${format(values.start_time, "PPP")}`,
            studentName: student.name,
            date: format(values.start_time, "PPP"),
            time: `${format(values.start_time, "p")} - ${format(addMinutes(values.start_time, parseInt(values.lesson_length, 10)), "p")}`,
            instructorName: instructorName
          });
        }
      }
      
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
                <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Driving lesson">Driving lesson</SelectItem>
                  <SelectItem value="Driving Test">Driving Test</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Availability">Availability Slot</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch("lesson_type") !== "Availability" && (
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1 w-full">
              <FormField
                control={form.control}
                name="student_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Student</FormLabel>
                    <FormControl>
                      <StudentSearch
                        value={field.value}
                        onChange={field.onChange}
                        students={students}
                        isLoading={isLoadingStudents}
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
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="60">1 hr</SelectItem>
                        <SelectItem value="90">1.5 hrs</SelectItem>
                        <SelectItem value="120">2 hrs</SelectItem>
                      </SelectContent>
                    </Select>
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
                <DatePicker date={field.value} setDate={field.onChange} />
                <TimePicker date={field.value} onChange={field.onChange} label="Start Time" />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-bold">Add Booking</Button>
      </form>
    </Form>
  );
};

export default AddBookingForm;