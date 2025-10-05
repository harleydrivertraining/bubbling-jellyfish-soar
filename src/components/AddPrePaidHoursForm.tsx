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
import { Textarea } from "@/components/ui/textarea";
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

interface Student {
  id: string;
  name: string;
}

const formSchema = z.object({
  student_id: z.string().min(1, { message: "Please select a student." }),
  package_hours: z.preprocess(
    (val) => Number(val),
    z.number().min(0.5, { message: "Hours must be at least 0.5." })
  ),
  amount_paid: z.preprocess(
    (val) => (val === "" ? null : Number(val)), // Allow empty string for optional number
    z.number().min(0, { message: "Amount paid cannot be negative." }).nullable().optional()
  ),
  notes: z.string().optional().nullable(),
});

interface AddPrePaidHoursFormProps {
  onHoursAdded: () => void;
  onClose: () => void;
}

const AddPrePaidHoursForm: React.FC<AddPrePaidHoursFormProps> = ({ onHoursAdded, onClose }) => {
  const { user } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [openStudentSelect, setOpenStudentSelect] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      package_hours: 1,
      amount_paid: null,
      notes: "",
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
        console.error("Error fetching students for pre-paid hours form:", error);
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
      showError("You must be logged in to add pre-paid hours.");
      return;
    }

    const { data, error } = await supabase
      .from("pre_paid_hours")
      .insert({
        user_id: user.id,
        student_id: values.student_id,
        package_hours: values.package_hours,
        remaining_hours: values.package_hours, // Initially, remaining hours are equal to package hours
        amount_paid: values.amount_paid,
        notes: values.notes,
      })
      .select();

    if (error) {
      console.error("Error adding pre-paid hours:", error);
      showError("Failed to add pre-paid hours: " + error.message);
    } else {
      showSuccess("Pre-paid hours added successfully!");
      form.reset();
      onHoursAdded();
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
          name="package_hours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hours Purchased</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  placeholder="e.g., 10"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount_paid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount Paid (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 500.00"
                  {...field}
                  value={field.value === null ? "" : field.value} // Handle null for empty input
                  onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
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
                <Textarea placeholder="e.g., 10-hour package, paid in cash" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Add Pre-Paid Hours</Button>
      </form>
    </Form>
  );
};

export default AddPrePaidHoursForm;