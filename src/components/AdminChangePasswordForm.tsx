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
import { Lock, Loader2, ShieldAlert } from "lucide-react";

const formSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

interface AdminChangePasswordFormProps {
  instructorId: string;
  instructorName: string;
  onSuccess: () => void;
}

const AdminChangePasswordForm: React.FC<AdminChangePasswordFormProps> = ({ 
  instructorId, 
  instructorName,
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
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('admin_change_user_password', {
        target_user_id: instructorId,
        new_password: values.password
      });

      if (error) throw error;

      showSuccess(`Password updated for ${instructorName}`);
      onSuccess();
    } catch (error: any) {
      console.error("Password change error:", error);
      showError(error.message || "Failed to change password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            You are about to force a password change for <strong>{instructorName}</strong>. 
            They will need this new password to sign in immediately.
          </p>
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="••••••••" className="pl-10" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-bold h-12" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Instructor Password"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default AdminChangePasswordForm;