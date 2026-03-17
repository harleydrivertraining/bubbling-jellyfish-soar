"use client";

import React, { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { KeyRound, UserCheck } from "lucide-react";

const formSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

interface EnableStudentLoginFormProps {
  studentId: string;
  studentPhone: string;
  studentName: string;
  onSuccess: () => void;
}

const EnableStudentLoginForm: React.FC<EnableStudentLoginFormProps> = ({ 
  studentId, 
  studentPhone, 
  studentName,
  onSuccess 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const cleanPhone = studentPhone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    
    if (!cleanPhone) {
      showError("Student must have a valid phone number to enable login.");
      return;
    }

    setIsSubmitting(true);
    try {
      const virtualEmail = `${cleanPhone}@student.hdt.app`;
      
      // 1. Create the Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: virtualEmail,
        password: values.password,
        options: {
          data: {
            role: 'student',
            display_name: studentName,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Link the student record to the auth user
        // We use the current instructor's session to perform this update
        const { error: updateError } = await supabase
          .from("students")
          .update({ auth_user_id: authData.user.id })
          .eq("id", studentId);

        if (updateError) {
          console.error("Link error:", updateError);
          throw new Error("Auth account created, but failed to link to student record. Please check RLS policies.");
        }

        showSuccess(`Login enabled for ${studentName}!`);
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error enabling student login:", error);
      showError(error.message || "Failed to enable login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
            <UserCheck className="h-4 w-4" />
            Login Credentials
          </div>
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Username (Phone):</strong> {studentPhone}</p>
            <p><strong>Virtual Email:</strong> {studentPhone.replace(/\s+/g, '')}@student.hdt.app</p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Set Student Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="••••••••" className="pl-10" {...field} />
                </div>
              </FormControl>
              <FormDescription>Give this password to the student so they can sign in.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
          {isSubmitting ? "Enabling..." : "Enable Student Access"}
        </Button>
      </form>
    </Form>
  );
};

export default EnableStudentLoginForm;