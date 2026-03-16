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
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";

const formSchema = z.object({
  hours_to_deduct: z.preprocess(
    (val) => Number(val),
    z.number().min(0.1, { message: "Must deduct at least 0.1 hours." })
  ),
  notes: z.string().min(1, { message: "Please provide a reason for the manual deduction." }),
});

interface DeductPrePaidHoursFormProps {
  packageId: string;
  studentId: string;
  remainingHours: number;
  onDeducted: () => void;
  onClose: () => void;
}

const DeductPrePaidHoursForm: React.FC<DeductPrePaidHoursFormProps> = ({
  packageId,
  studentId,
  remainingHours,
  onDeducted,
  onClose,
}) => {
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hours_to_deduct: 1,
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    if (values.hours_to_deduct > remainingHours) {
      showError(`Cannot deduct more than the remaining balance (${remainingHours.toFixed(1)} hrs).`);
      return;
    }

    // 1. Update the package balance
    const { error: updateError } = await supabase
      .from("pre_paid_hours")
      .update({ remaining_hours: remainingHours - values.hours_to_deduct })
      .eq("id", packageId);

    if (updateError) {
      showError("Failed to update package: " + updateError.message);
      return;
    }

    // 2. Record the manual transaction
    const { error: transactionError } = await supabase
      .from("pre_paid_hours_transactions")
      .insert({
        user_id: user.id,
        student_id: studentId,
        pre_paid_hours_id: packageId,
        hours_deducted: values.hours_to_deduct,
        transaction_date: new Date().toISOString(),
        notes: values.notes,
      });

    if (transactionError) {
      console.error("Error recording transaction:", transactionError);
      // We don't show an error to the user here because the balance was already updated successfully
    }

    showSuccess("Hours deducted successfully!");
    onDeducted();
    onClose();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-muted/50 p-3 rounded-lg text-sm mb-4">
          Current Balance: <span className="font-bold">{remainingHours.toFixed(1)} hours</span>
        </div>
        
        <FormField
          control={form.control}
          name="hours_to_deduct"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hours to Deduct</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 1.5"
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
              <FormLabel>Reason / Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Manual adjustment for off-app lesson" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" variant="destructive">
          Confirm Deduction
        </Button>
      </form>
    </Form>
  );
};

export default DeductPrePaidHoursForm;