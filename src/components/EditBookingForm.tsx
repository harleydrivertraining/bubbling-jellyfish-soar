"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "@hookform/react-hook-form";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Student {
  id: string;
  name: string;
}

const formSchema = z.object({
  student_id: z.string().min(1, { message: "Please select a student." }),
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
  description: z.string().optional().nullable(),
  lesson_type: z.enum(["Driving lesson", "Driving Test", "Personal"], {
    message: "Please select a valid lesson type.",
  }),
  lesson_length: z.enum(["60", "90", "120"], {
    message: "Please select a valid lesson length.",
  }),
  targets_for_next_session: z.string().optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"], { // Added status field
    message: "Please select a valid status.",
  }),
  // Repeat booking fields are for creation, not typically edited on an existing single booking
  // Keeping them optional for schema consistency but won't be used for editing existing single events
  repeat_booking: z.enum(["none", "weekly", "fortnightly"]).optional(),
  repeat_count: z.number().min(1).max(12).optional(),
  start_time: z.date({ required_error: "Start time is required." }),
  end_time: z.date({ required_error: "End time is required." }),
});

interface EditBookingFormProps {
  bookingId: string;
  onBookingUpdated: () => void;
  onBookingDeleted: () => void;
  onClose: () => void;
}

const EditBookingForm: React.FC<EditBookingFormProps> = ({
  bookingId,
  onBookingUpdated,
  onBookingDeleted,
  onClose,
}) => {
  const { user } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);
  const [openStudentSelect, setOpenStudentSelect] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      title: "",
      description: "",
      lesson_type: "Driving lesson",
      lesson_length: "60", // Default for calculation, will be overwritten
      targets_for_next_session: "",
      status: "scheduled", // Default status
      start_time: new Date(),
      end_time: new Date(),
    },
  });

  const selectedLessonLength = form.watch("lesson_length");
  const selectedStartTime = form.watch("start_time");

  // Effect to update end_time when start_time or lesson_length changes
  useEffect(() => {
    if (selectedStartTime && selectedLessonLength) {
      const lengthInMinutes = parseInt(selectedLessonLength, 10);
      const newEndTime = addMinutes(selectedStartTime, lengthInMinutes);
      form.setValue("end_time", newEndTime);
    }
  }, [selectedStartTime, selectedLessonLength, form]);

  // Fetch students and booking details
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoadingStudents(true);
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("user_id", user.id);

      if (studentError) {
        console.error("Error fetching students for edit booking form:", studentError);
        showError("Failed to load students: " + studentError.message);
        setStudents([]);
      } else {
        setStudents(studentData || []);
      }
      setIsLoadingStudents(false);

      setIsLoadingBooking(true);
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*, students(name)")
        .eq("id", bookingId)
        .single();

      if (bookingError) {
        console.error("Error fetching booking details:", bookingError);
        showError("Failed to load booking details: " + bookingError.message);
        onClose(); // Close the dialog if booking not found or error
      } else if (bookingData) {
        const startTime = new Date(bookingData.start_time);
        const endTime = new Date(bookingData.end_time);
        const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // duration in minutes

        form.reset({
          student_id: bookingData.student_id,
          title: bookingData.title,
          description: bookingData.description || "",
          lesson_type: bookingData.lesson_type as "Driving lesson" | "Driving Test" | "Personal",
          lesson_length: duration.toString() as "60" | "90" | "120",
          targets_for_next_session: bookingData.targets_for_next_session || "",
          status: bookingData.status as "scheduled" | "completed" | "cancelled", // Set status
          start_time: startTime,
          end_time: endTime,
        });
      }
      setIsLoadingBooking(false);
    };

    fetchData();
  }, [bookingId, user, form, onClose]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update a booking.");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        student_id: values.student_id,
        title: values.title,
        description: values.description,
        lesson_type: values.lesson_type,
        targets_for_next_session: values.targets_for_next_session,
        status: values.status, // Include status in update
        start_time: values.start_time.toISOString(),
        end_time: values.end_time.toISOString(),
      })
      .eq("id", bookingId);

    if (error) {
      console.error("Error updating booking:", error);
      showError("Failed to update booking: " + error.message);
    } else {
      showSuccess("Booking updated successfully!");
      onBookingUpdated();
    }
  };

  const handleDelete = async () => {
    if (!user) {
      showError("You must be logged in to delete a booking.");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (error) {
      console.error("Error deleting booking:", error);
      showError("Failed to delete booking: " + error.message);
    } else {
      showSuccess("Booking deleted successfully!");
      onBookingDeleted();
    }
  };

  if (isLoadingBooking || isLoadingStudents) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="student_id"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Student</FormLabel>
              <Popover open={openStudentSelect} onOpenChange={setOpenStudentSelect}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isLoadingStudents}
                    >
                      {field.value
                        ? students.find((student) => student.id === field.value)?.name
                        : "Select a student"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search student..." />
                    <CommandEmpty>No student found.</CommandEmpty>
                    <CommandGroup>
                      {students.map((student) => (
                        <CommandItem
                          value={student.name}
                          key={student.id}
                          onSelect={() => {
                            form.setValue("student_id", student.id);
                            setOpenStudentSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              student.id === field.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {student.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="lesson_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lesson Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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

          <FormField
            control={form.control}
            name="lesson_length"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lesson Length</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select length" />
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

        <div className="grid grid-cols-2 gap-3">
          <FormItem>
            <FormLabel>Start Time</FormLabel>
            <Input
              type="text"
              value={format(selectedStartTime, "PPP p")}
              readOnly
              className="bg-muted"
            />
          </FormItem>
          <FormItem>
            <FormLabel>End Time</FormLabel>
            <Input
              type="text"
              value={format(form.getValues("end_time"), "PPP p")}
              readOnly
              className="bg-muted"
            />
          </FormItem>
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lesson Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., first lesson, highway practice" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targets_for_next_session"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Targets for Next Session (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., practice parallel parking, focus on mirror checks" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Booking Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Update Booking</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete Booking</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this booking.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </form>
    </Form>
  );
};

export default EditBookingForm;