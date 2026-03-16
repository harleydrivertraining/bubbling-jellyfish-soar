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
import { Switch } from "@/components/ui/switch";
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";
import { Repeat } from "lucide-react";

const formSchema = z.object({
  amount: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, { message: "Amount must be greater than 0." })
  ),
  description: z.string().min(2, { message: "Description is required." }),
  category: z.string().min(1, { message: "Please select a category." }),
  custom_category: z.string().optional(),
  date: z.date({ required_error: "Date is required." }),
  is_recurring: z.boolean().default(false),
  frequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly']).optional(),
  end_date: z.date().optional().nullable(),
});

interface AddExpenditureFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AddExpenditureForm: React.FC<AddExpenditureFormProps> = ({ onSuccess, onClose }) => {
  const { user } = useSession();
  const [categories, setCategories] = useState<string[]>([]);
  const [isCustom, setIsCustom] = useState(false);

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
      category: "Fuel",
      custom_category: "",
      date: new Date(),
      is_recurring: false,
      frequency: "weekly",
      end_date: null,
    },
  });

  const isRecurring = form.watch("is_recurring");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    let finalCategory = values.category;

    if (values.category === "Other" && values.custom_category?.trim()) {
      finalCategory = values.custom_category.trim();
      
      if (!categories.includes(finalCategory)) {
        await supabase
          .from("expenditure_categories")
          .insert({ user_id: user.id, name: finalCategory });
      }
    }

    // 1. Always add the initial expenditure entry
    const { error: expError } = await supabase
      .from("expenditures")
      .insert({
        user_id: user.id,
        amount: values.amount,
        description: values.description + (values.is_recurring ? " (Recurring)" : ""),
        category: finalCategory,
        date: format(values.date, "yyyy-MM-dd"),
      });

    if (expError) {
      showError("Failed to add expenditure: " + expError.message);
      return;
    }

    // 2. If recurring is checked, set up the schedule
    if (values.is_recurring && values.frequency) {
      const { error: recError } = await supabase
        .from("recurring_expenditures")
        .insert({
          user_id: user.id,
          amount: values.amount,
          description: values.description,
          category: finalCategory,
          frequency: values.frequency,
          start_date: format(values.date, "yyyy-MM-dd"),
          end_date: values.end_date ? format(values.end_date, "yyyy-MM-dd") : null,
          last_processed_date: format(values.date, "yyyy-MM-dd"), // Mark today as processed
          is_active: true
        });

      if (recError) {
        showError("Expenditure added, but failed to set up recurring schedule: " + recError.message);
      } else {
        showSuccess("Recurring expenditure set up successfully!");
      }
    } else {
      showSuccess("Expenditure added successfully!");
    }

    onSuccess();
    onClose();
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
        
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select 
                onValueChange={(val) => {
                  field.onChange(val);
                  setIsCustom(val === "Other");
                }} 
                defaultValue={field.value}
              >
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
                  {!categories.includes("Other") && <SelectItem value="Other">Other (Add New)</SelectItem>}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isCustom && (
          <FormField
            control={form.control}
            name="custom_category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Category Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Office Supplies" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <FormControl>
                <DatePicker date={field.value} setDate={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
          <FormField
            control={form.control}
            name="is_recurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" /> Make Recurring
                  </FormLabel>
                  <FormDescription className="text-[10px]">Automatically repeat this cost</FormDescription>
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

          {isRecurring && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat Frequency</FormLabel>
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

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <DatePicker date={field.value || undefined} setDate={field.onChange} placeholder="Never ends" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Shell fuel station" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-bold">
          {isRecurring ? "Set Up Recurring Cost" : "Add Expenditure Entry"}
        </Button>
      </form>
    </Form>
  );
};

export default AddExpenditureForm;