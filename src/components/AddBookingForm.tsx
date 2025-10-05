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
import { format } from "date-fns";

// Define the schema for a student to be used in the select dropdown
interface Student {
  id: string;
  name: string;
}

const formSchema = z.object({
  student_id: z.string().min(1, { message: "Please select a student." }),
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
  description: z.string().optional().nullable(),
  start_time: z.date({ required_error: "Start time is required." }),
  end_time: z.date({ required_error: "End time is required." }),
});

interface AddBookingFormProps {
  initialStartTime: Date;
  initialEndTime: Date;
  onBookingAdded: () => void;
  onClose: () => void;
}

const AddBookingForm: React.FC<AddBookingFormProps> = ({
  initialStartTime,
  initialEndTime,
  onBookingAdded,
  onClose,
}) => {
  const { user } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      title: "Driving Lesson",
      description: "",
      start_time: initialStartTime,
      end_time: initialEndTime,
    },
  });

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return;
      setIsLoadingStudents(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching students for booking form:", error);
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

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        student_id: values.student_id,
        title: values.title,
        description: values.description,
        start_time: values.start_time.toISOString(),
        end_time: values.end_time.toISOString(),
        status: "scheduled",
      })
      .select();

    if (error) {
      console.error("Error adding booking:", error);
      showError("Failed to add booking: " + error.message);
    } else {
      showSuccess("Booking added successfully!");
      form.reset();
      onBookingAdded();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="student_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger disabled={isLoadingStudents}>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {students.length === 0 && !isLoadingStudents ? (
                    <SelectItem value="" disabled>No students available</SelectItem>
                  ) : (
                    students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Driving Lesson" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., first lesson, highway practice" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Start Time</FormLabel>
          <Input
            type="text"
            value={format(initialStartTime, "PPP p")}
            readOnly
            className="bg-muted"
          />
        </FormItem>
        <FormItem>
          <FormLabel>End Time</FormLabel>
          <Input
            type="text"
            value={format(initialEndTime, "PPP p")}
            readOnly
            className="bg-muted"
          />
        </FormItem>
        <Button type="submit" className="w-full">Add Booking</Button>
      </form>
    </Form>
  );
};

export default AddBookingForm;