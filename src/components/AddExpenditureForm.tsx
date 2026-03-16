"use client";

import React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";

const EXPENDITURE_CATEGORIES = [
  "Fuel",
  "Insurance",
  "Maintenance",
  "Repairs",
  "Marketing",
  "Software/Apps",
  "Training/CPD",
  "Vehicle Lease/Loan",
  "Other",
];

const formSchema = z.object({
  amount: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, { message: "Amount must be greater than 0." })
  ),
  description: z.string().min(2, { message: "Description is required." }),
  category: z.string().min(1, { message: "Please select a category." }),
  date: z.date({ required_error: "Date is required." }),
});

interface AddExpenditureFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AddExpenditureForm: React.FC<AddExpenditureFormProps> = ({ onSuccess, onClose }) => {
  const { user } = useSession();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      description: "",
      category: "Fuel",
      date: new Date(),
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    const { error } = await supabase
      .from("expenditures")
      .insert({
        user_id: user.id,
        amount: values.amount,
        description: values.description,
        category: values.category,
        date: format(values.date, "yyyy-MM-dd"),
      });

    if (error) {
      showError("Failed to add expenditure: " + error.message);
    } else {
      showSuccess("Expenditure added successfully!");
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
                  {EXPENDITURE_CATEGORIES.map((cat) => (
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
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Shell fuel station, Annual insurance renewal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-bold">Add Expenditure Entry</Button>
      </form>
    </Form>
  );
};

export default AddExpenditureForm;