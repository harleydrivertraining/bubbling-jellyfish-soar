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
import DatePicker from "@/components/DatePicker"; // Import DatePicker
import TimePicker from "@/components/TimePicker"; // Import the new TimePicker

interface Student {
  id: string;
  name: string;
}

const formSchema = z.object({
  student_id: z.string().min(1, { message: "Please select a student." }),
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
  // end_time is now calculated, not directly input
});

interface AddBookingFormProps {
  initialStartTime: Date;
  initialEndTime: Date; // Still passed for initial calculation, but not directly used in form
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
  const [openStudentSelect, setOpenStudentSelect] = useState(false);

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
      // end_time is derived, not a default value
    },
  });

  const selectedLessonLength = form.watch("lesson_length");
  const selectedStartTime = form.watch("start_time");
  const selectedRepeatBooking = form.watch("repeat_booking");
  const selectedStudentId = form.watch("student_id"); // Watch student_id to generate title

  // State to hold the calculated end time
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

    const studentName = students.find(s => s.id === values.student_id)?.name || "Unknown Student";
    const generatedTitle = `${studentName} - ${values.lesson_type}`;

    const bookingsToInsert = [];
    const numRepeats = values.repeat_booking !== "none" ? (values.repeat_count || 1) : 1;
    const interval = values.repeat_booking === "weekly" ? 1 : 2;

    for (let i = 0; i < numRepeats; i++) {
      let currentStartTime = values.start_time;
      let currentEndTime = calculatedEndTime; // Use the calculated end time

      if (i > 0 && values.repeat_booking !== "none") {
        currentStartTime = addWeeks(values.start_time, i * interval);
        // Recalculate end time for repeated bookings based on the new start time
        const lengthInMinutes = parseInt(values.lesson_length, 10);
        currentEndTime = addMinutes(currentStartTime, lengthInMinutes);
      }

      bookingsToInsert.push({
        user_id: user.id,
        student_id: values.student_id,
        title: generatedTitle,
        description: values.description,
        lesson_type: values.lesson_type,
        targets_for_next_session: values.targets_for_next_session,
        start_time: currentStartTime.toISOString(),
        end_time: currentEndTime.toISOString(),
        status: "scheduled",
      });
    }

    const { data, error } = await supabase
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

        {/* Start Time Field */}
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

        {/* Display calculated End Time */}
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
                    <Input
                      type="number"
                      placeholder="e.g., 4"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      min={1}
                      max={12}
                    />
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