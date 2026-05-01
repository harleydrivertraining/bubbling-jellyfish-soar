"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format, addMinutes, isValid } from "date-fns";
import { Target, X, Plus, Minus } from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
  lesson_length: z.string().min(1, "Length is required"),
  targets_for_next_session: z.string().optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"], {
    message: "Please select a valid status.",
  }),
  start_time: z.date({ required_error: "Start time is required." }),
  end_time: z.date({ required_error: "End time is required." }),
  is_paid: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.lesson_type !== "Personal" && !data.student_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select a student for this lesson type.",
      path: ["student_id"],
    });
  }
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
  const [previousTargets, setPreviousTargets] = useState<string | null>(null);
  const [isLoadingPrevTargets, setIsLoadingPrevTargets] = useState(false);
  const [isCustomLength, setIsCustomLength] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      description: "",
      lesson_type: "Driving lesson",
      lesson_length: "60",
      targets_for_next_session: "",
      status: "scheduled",
      start_time: new Date(),
      end_time: new Date(),
      is_paid: false,
    },
  });

  const selectedLessonLength = form.watch("lesson_length");
  const selectedStartTime = form.watch("start_time");
  const selectedLessonType = form.watch("lesson_type");
  const selectedStudentId = form.watch("student_id");
  const currentEndTime = form.watch("end_time");

  const fetchPreviousTargets = useCallback(async (studentId: string, startTime: Date) => {
    if (!studentId) { 
      setPreviousTargets(null); 
      return; 
    }
    setIsLoadingPrevTargets(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("targets_for_next_session")
      .eq("student_id", studentId)
      .lt("start_time", startTime.toISOString())
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error("Error fetching previous targets:", error);
    } else {
      setPreviousTargets(data?.targets_for_next_session || null);
    }
    setIsLoadingPrevTargets(false);
  }, []);

  useEffect(() => {
    if (selectedStudentId && selectedStartTime) {
      fetchPreviousTargets(selectedStudentId, selectedStartTime);
    }
  }, [selectedStudentId, selectedStartTime, fetchPreviousTargets]);

  useEffect(() => {
    if (selectedStartTime && selectedLessonLength) {
      const lengthInMinutes = parseInt(selectedLessonLength, 10);
      if (!isNaN(lengthInMinutes)) {
        const newEndTime = addMinutes(selectedStartTime, lengthInMinutes);
        form.setValue("end_time", newEndTime);
      }
    }
  }, [selectedStartTime, selectedLessonLength, form]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoadingStudents(true);
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("user_id", user.id);
      
      if (studentError) {
        console.error("Error fetching students:", studentError);
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
        onClose();
      } else if (bookingData) {
        const startTime = new Date(bookingData.start_time);
        const endTime = new Date(bookingData.end_time);
        const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        const durationStr = Math.round(duration).toString();

        if (durationStr !== "60" && durationStr !== "90" && durationStr !== "120") {
          setIsCustomLength(true);
        }

        form.reset({
          student_id: bookingData.student_id,
          description: bookingData.description || "",
          lesson_type: bookingData.lesson_type as "Driving lesson" | "Driving Test" | "Personal",
          lesson_length: durationStr,
          targets_for_next_session: bookingData.targets_for_next_session || "",
          status: bookingData.status as "scheduled" | "completed" | "cancelled",
          start_time: startTime,
          end_time: endTime,
          is_paid: bookingData.is_paid || false,
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
    
    let generatedTitle = "Personal Appointment";
    if (values.lesson_type !== "Personal" || values.student_id) {
      const studentName = students.find(s => s.id === values.student_id)?.name || "Unknown Student";
      generatedTitle = `${studentName} - ${values.lesson_type}`;
    }
    
    const { error } = await supabase
      .from("bookings")
      .update({ 
        student_id: values.student_id || null, 
        title: generatedTitle, 
        description: values.description, 
        lesson_type: values.lesson_type, 
        targets_for_next_session: values.targets_for_next_session, 
        status: values.status, 
        start_time: values.start_time.toISOString(), 
        end_time: values.end_time.toISOString(), 
        is_paid: values.is_paid 
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
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
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

          <div className="w-full sm:w-[180px]">
            <FormField
              control={form.control}
              name="lesson_length"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Length (Mins)</FormLabel>
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
                        className="h-10 font-bold text-center flex-1 min-w-[60px]" 
                        placeholder="Mins" 
                        autoFocus 
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
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
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

        <FormItem>
          <FormLabel>End Time</FormLabel>
          <Input 
            type="text" 
            value={isValid(currentEndTime) ? format(currentEndTime, "PPP p") : "Invalid time"} 
            readOnly 
            className="bg-muted font-medium" 
          />
        </FormItem>

        {selectedLessonType !== "Personal" && selectedStudentId && (
          <div className="space-y-2 p-3 bg-primary/5 border border-primary/10 rounded-lg">
            <Label className="text-xs font-bold uppercase text-primary flex items-center">
              <Target className="mr-1.5 h-3.5 w-3.5" /> Targets for this session
            </Label>
            {isLoadingPrevTargets ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <p className="text-sm font-bold text-foreground italic">
                {previousTargets || "No targets set from previous lesson."}
              </p>
            )}
          </div>
        )}

        <FormField 
          control={form.control} 
          name="description" 
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., dentist appointment" {...field} />
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

        <div className="grid grid-cols-2 gap-4">
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
          <FormField 
            control={form.control} 
            name="is_paid" 
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Paid</FormLabel>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} 
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1 font-black">Update Booking</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1 font-bold">Delete Booking</Button>
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