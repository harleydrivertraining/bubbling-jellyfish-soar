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
import { Switch } from "@/components/ui/switch";
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
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
import { Textarea } from "@/components/ui/textarea"; // Import Textarea

interface Student {
  id: string;
  name: string;
}

const formSchema = z.object({
  student_id: z.string().min(1, { message: "Please select a student." }),
  test_date: z.date({ required_error: "Test date is required." }),
  passed: z.boolean(),
  driving_faults: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, { message: "Driving faults cannot be negative." })
  ),
  serious_faults: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, { message: "Serious faults cannot be negative." })
  ),
  examiner_action: z.boolean(),
  notes: z.string().optional().nullable(), // New notes field
});

interface EditDrivingTestFormProps {
  testId: string;
  onTestUpdated: () => void;
  onTestDeleted: () => void;
  onClose: () => void;
}

const EditDrivingTestForm: React.FC<EditDrivingTestFormProps> = ({
  testId,
  onTestUpdated,
  onTestDeleted,
  onClose,
}) => {
  const { user } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [openStudentSelect, setOpenStudentSelect] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      test_date: new Date(),
      passed: false,
      driving_faults: 0,
      serious_faults: 0,
      examiner_action: false,
      notes: "", // Default for new notes field
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoadingStudents(true);
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (studentError) {
        console.error("Error fetching students for edit driving test form:", studentError);
        showError("Failed to load students: " + studentError.message);
        setStudents([]);
      } else {
        setStudents(studentData || []);
      }
      setIsLoadingStudents(false);

      setIsLoadingTest(true);
      const { data: testData, error: testError } = await supabase
        .from("driving_tests")
        .select("*, students(name)")
        .eq("id", testId)
        .eq("user_id", user.id)
        .single();

      if (testError) {
        console.error("Error fetching driving test details:", testError);
        showError("Failed to load driving test details: " + testError.message);
        onClose();
      } else if (testData) {
        form.reset({
          student_id: testData.student_id,
          test_date: new Date(testData.test_date),
          passed: testData.passed,
          driving_faults: testData.driving_faults,
          serious_faults: testData.serious_faults,
          examiner_action: testData.examiner_action,
          notes: testData.notes || "", // Populate notes field
        });
      }
      setIsLoadingTest(false);
    };

    fetchData();
  }, [testId, user, form, onClose]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update a driving test record.");
      return;
    }

    const { error } = await supabase
      .from("driving_tests")
      .update({
        student_id: values.student_id,
        test_date: values.test_date.toISOString().split('T')[0],
        passed: values.passed,
        driving_faults: values.driving_faults,
        serious_faults: values.serious_faults,
        examiner_action: values.examiner_action,
        notes: values.notes, // Include notes in update
      })
      .eq("id", testId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating driving test record:", error);
      showError("Failed to update driving test record: " + error.message);
    } else {
      showSuccess("Driving test record updated successfully!");
      onTestUpdated();
    }
  };

  const handleDelete = async () => {
    if (!user) {
      showError("You must be logged in to delete a driving test record.");
      return;
    }

    const { error } = await supabase
      .from("driving_tests")
      .delete()
      .eq("id", testId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting driving test record:", error);
      showError("Failed to delete driving test record: " + error.message);
    } else {
      showSuccess("Driving test record deleted successfully!");
      onTestDeleted();
    }
  };

  if (isLoadingTest || isLoadingStudents) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
          name="test_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Test Date</FormLabel>
              <FormControl>
                <DatePicker
                  date={field.value}
                  setDate={field.onChange}
                  placeholder="Select test date"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="passed"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Passed Test</FormLabel>
                <FormDescription>
                  Toggle if the student passed the driving test.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="driving_faults"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Driving Faults</FormLabel>
              <FormControl>
                <Input type="number" min="0" placeholder="e.g., 3" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="serious_faults"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serious Faults</FormLabel>
              <FormControl>
                <Input type="number" min="0" placeholder="e.g., 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="examiner_action"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Examiner Action Taken</FormLabel>
                <FormDescription>
                  Toggle if the examiner had to take any physical action during the test.
                </FormDescription>
              </div >
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Student was nervous but performed well on maneuvers." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Update Record</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete Record</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this driving test record.
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

export default EditDrivingTestForm;