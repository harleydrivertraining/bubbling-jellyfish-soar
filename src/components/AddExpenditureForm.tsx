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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format, addDays } from "date-fns";
import { Repeat } from "lucide-react";

const formSchema = z.object({
  amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0.01, { message: "Amount must be greater than 0." })
  ),
  description: z.string().optional().nullable(),
  category: z.string().min(1, { message: "Please select a category." }),
  custom_category: z.string().optional(),
  date: z.date({ required_error: "Date is required." }),
  is_recurring: z.boolean().default(false),
  frequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly']).optional(),
  day_of_week: z.string().optional(),
  end_type: z.enum(['never', 'date', 'occurrences']).optional(),
  end_date: z.date().optional().nullable(),
  max_occurrences: z.preprocess(
    (val) => (val === "" || val === null ? null : Number(val)),
    z.number().min(1, { message: "Must be at least 1." }).optional().nullable()
  ),
});

const DAYS = [
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
  { label: "Sunday", value: "0" },
];

interface AddExpenditureFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AddExpenditureForm: React.FC<AddExpenditureFormProps> = ({ onSuccess, onClose }) => {
  const { user } = useSession();
  const [categories, setCategories] = useState<string[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("expenditure_categories")
      .select("name")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    
    setCategories(data?.map(c => c.name) || ["Fuel", "Insurance", "Maintenance", "Other"]);
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
      day_of_week: "1",
      end_type: "never",
      end_date: null,
      max_occurrences: null,
    },
  });

  const isRecurring = form.watch("is_recurring");
  const frequency = form.watch("frequency");
  const endType = form.watch("end_type");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      let finalCategory = values.category;

      if (values.category === "Other" && values.custom_category?.trim()) {
        finalCategory = values.custom_category.trim();
        if (!categories.includes(finalCategory)) {
          await supabase.from("expenditure_categories").insert({ user_id: user.id, name: finalCategory });
        }
      }

      const baseDescription = values.description || finalCategory;
      const finalDescription = baseDescription + (values.is_recurring ? " (Recurring)" : "");

      // 1. Add the initial expenditure entry
      const { error: expError } = await supabase
        .from("expenditures")
        .insert({
          user_id: user.id,
          amount: values.amount,
          description: finalDescription,
          category: finalCategory,
          date: format(values.date, "yyyy-MM-dd"),
        });

      if (expError) throw expError;

      // 2. If recurring is checked, set up the schedule
      if (values.is_recurring && values.frequency) {
        let finalStartDate = values.date;
        
        if ((values.frequency === 'weekly' || values.frequency === 'fortnightly') && values.day_of_week) {
          const targetDay = parseInt(values.day_of_week);
          while (finalStartDate.getDay() !== targetDay) {
            finalStartDate = addDays(finalStartDate, 1);
          }
        }

        const { error: recError } = await supabase
          .from("recurring_expenditures")
          .insert({
            user_id: user.id,
            amount: values.amount,
            description: baseDescription,
            category: finalCategory,
            frequency: values.frequency,
            day_of_week: (values.frequency === 'weekly' || values.frequency === 'fortnightly') ? parseInt(values.day_of_week || "1") : null,
            start_date: format(finalStartDate, "yyyy-MM-dd"),
            last_processed_date: format(values.date, "yyyy-MM-dd"),
            end_date: values.end_type === 'date' && values.end_date ? format(values.end_date, "yyyy-MM-dd") : null,
            max_occurrences: values.end_type === 'occurrences' ? values.max_occurrences : null,
            current_occurrences: 1,
            is_active: true
          });

        if (recError) throw recError;
        showSuccess("Recurring expenditure set up successfully!");
      } else {
        showSuccess("Expenditure added successfully!");
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Form submission error:", error);
      showError(error.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
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
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other (Add New)</SelectItem>
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
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          <Label className="font-normal">Never</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="date" /></FormControl>
                          <Label className="font-normal">On specific date</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="occurrences" /></FormControl>
                          <Label className="font-normal">After a number of times</Label>
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
                    <FormItem className="flex flex-col">
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
                    <FormItem>
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
          )}
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Shell fuel station" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isRecurring ? "Set Up Recurring Cost" : "Add Expenditure Entry"}
        </Button>
      </form>
    </Form>
  );
};

export default AddExpenditureForm;