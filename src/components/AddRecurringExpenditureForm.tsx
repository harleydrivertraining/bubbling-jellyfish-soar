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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format, setDay, isBefore, addDays } from "date-fns";

const formSchema = z.object({
  amount: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, { message: "Amount must be greater than 0." })
  ),
  description: z.string().optional().nullable(),
  category: z.string().min(1, { message: "Please select a category." }),
  frequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly']),
  day_of_week: z.string().optional(),
  start_date: z.date({ required_error: "Start date is required." }),
  end_type: z.enum(['never', 'date', 'occurrences']),
  end_date: z.date().optional().nullable(),
  max_occurrences: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(1).optional().nullable()
  ),
});

interface AddRecurringExpenditureFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

const DAYS = [
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
  { label: "Sunday", value: "0" },
];

const AddRecurringExpenditureForm: React.FC<AddRecurringExpenditureFormProps> = ({ onSuccess, onClose }) => {
  const { user } = useSession();
  const [categories, setCategories] = useState<string[]>([]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("expenditure_categories")
      .select("name")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    
    setCategories(data?.map(c => c.name) || ["Other"]);
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      description: "",
      category: "Other",
      frequency: "weekly",
      day_of_week: "1",
      start_date: new Date(),
      end_type: "never",
      end_date: null,
      max_occurrences: null,
    },
  });

  const frequency = form.watch("frequency");
  const endType = form.watch("end_type");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    let finalStartDate = values.start_date;
    
    // If a specific day of week is chosen for weekly/fortnightly, adjust start date to the next occurrence of that day
    if ((values.frequency === 'weekly' || values.frequency === 'fortnightly') && values.day_of_week) {
      const targetDay = parseInt(values.day_of_week);
      while (finalStartDate.getDay() !== targetDay) {
        finalStartDate = addDays(finalStartDate, 1);
      }
    }

    const { error } = await supabase
      .from("recurring_expenditures")
      .insert({
        user_id: user.id,
        amount: values.amount,
        description: values.description || values.category,
        category: values.category,
        frequency: values.frequency,
        day_of_week: (values.frequency === 'weekly' || values.frequency === 'fortnightly') ? parseInt(values.day_of_week || "1") : null,
        start_date: format(finalStartDate, "yyyy-MM-dd"),
        end_date: values.end_type === 'date' ? format(values.end_date!, "yyyy-MM-dd") : null,
        max_occurrences: values.end_type === 'occurrences' ? values.max_occurrences : null,
        is_active: true
      });

    if (error) {
      showError("Failed to add recurring expenditure: " + error.message);
    } else {
      showSuccess("Recurring expenditure set up!");
      onSuccess();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (£)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0.00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {(frequency === 'weekly' || frequency === 'fortnightly') && (
            <FormField
              control={form.control}
              name="day_of_week"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Day of Week</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <DatePicker date={field.value} setDate={field.onChange} />
                </FormControl>
                <FormDescription className="text-[10px]">First occurrence will be on or after this date.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
          <FormField
            control={form.control}
            name="end_type"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>End Condition</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl><RadioGroupItem value="never" /></FormControl>
                      <Label className="font-normal">Never (Repeat indefinitely)</Label>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl><RadioGroupItem value="date" /></FormControl>
                      <Label className="font-normal">On specific date</Label>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl><RadioGroupItem value="occurrences" /></FormControl>
                      <Label className="font-normal">After a number of occurrences</Label>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {endType === 'date' && (
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem className="flex flex-col animate-in slide-in-from-top-2 duration-200">
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <DatePicker date={field.value || undefined} setDate={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {endType === 'occurrences' && (
            <FormField
              control={form.control}
              name="max_occurrences"
              render={({ field }) => (
                <FormItem className="animate-in slide-in-from-top-2 duration-200">
                  <FormLabel>Number of Occurrences</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="e.g., 12" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Car Lease Payment" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-bold">Set Up Recurring Expenditure</Button>
      </form>
    </Form>
  );
};

export default AddRecurringExpenditureForm;