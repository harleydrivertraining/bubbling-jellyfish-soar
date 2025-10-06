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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";

const formSchema = z.object({
  entry_date: z.date({ required_error: "Entry date is required." }),
  start_mileage: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: "Start mileage cannot be negative." })
  ),
  end_mileage: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: "End mileage cannot be negative." })
  ),
  notes: z.string().optional().nullable(),
}).refine(data => data.end_mileage >= data.start_mileage, {
  message: "End mileage must be greater than or equal to start mileage.",
  path: ["end_mileage"],
});

interface AddMileageEntryFormProps {
  onEntryAdded: () => void;
  onClose: () => void;
  initialDate?: Date;
}

const AddMileageEntryForm: React.FC<AddMileageEntryFormProps> = ({ onEntryAdded, onClose, initialDate }) => {
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entry_date: initialDate || new Date(),
      start_mileage: 0,
      end_mileage: 0,
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to add a mileage entry.");
      return;
    }

    const { error } = await supabase
      .from("car_mileage_entries")
      .insert({
        user_id: user.id,
        entry_date: format(values.entry_date, "yyyy-MM-dd"),
        start_mileage: values.start_mileage,
        end_mileage: values.end_mileage,
        notes: values.notes,
      })
      .select();

    if (error) {
      console.error("Error adding mileage entry:", error);
      showError("Failed to add mileage entry: " + error.message);
    } else {
      showSuccess("Mileage entry added successfully!");
      form.reset();
      onEntryAdded();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date of Entry</FormLabel>
              <FormControl>
                <DatePicker
                  date={field.value}
                  setDate={field.onChange}
                  placeholder="Select date"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="start_mileage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Mileage</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 12345.6"
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
          name="end_mileage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End Mileage</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 12450.9"
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Fuel refill, maintenance check" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Add Mileage Entry</Button>
      </form>
    </Form>
  );
};

export default AddMileageEntryForm;