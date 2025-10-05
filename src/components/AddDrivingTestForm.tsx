"use client";

import React, { useState, useEffect } from "react";
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

interface AddDrivingTestFormProps {
  onTestAdded: () => void;
  onClose: () => void;
}

const AddDrivingTestForm: React.FC<AddDrivingTestFormProps> = ({ onTestAdded, onClose }) => {
  const { user } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
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
    const fetchStudents = async () => {
      if (!user) return;
      setIsLoadingStudents(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching students for driving test form:", error);
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
      showError("You must be logged in to add a driving test record.");
      return;
    }

    const { error } = await supabase
      .from("driving_tests")
      .insert({
        user_id: user.id,
        student_id: values.student_id,
        test_date: values.test_date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        passed: values.passed,
        driving_faults: values.driving_faults,
        serious_faults: values.serious_faults,
        examiner_action: values.examiner_action,
        notes: values.notes, // Include notes in the insert
      })
      .select();

    if (error) {
      console.error("Error adding driving test record:", error);
      showError("Failed to add driving test record: " + error.message);
    } else {
      showSuccess("Driving test record added successfully!");
      form.reset();
      onTestAdded();
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

        <Button type="submit" className="w-full">Add Test Record</Button>
      </form>
    </Form>
  );
};

export default AddDrivingTestForm;