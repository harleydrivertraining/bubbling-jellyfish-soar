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
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Mail, Loader2 } from "lucide-react";

const formSchema = z.object({
  new_email: z.string().email({ message: "Please enter a valid email address." }),
});

const ChangeEmailForm: React.FC = () => {
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      new_email: user?.email || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to change your email.");
      return;
    }

    if (values.new_email === user.email) {
      showError("This is already your current login email.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      email: values.new_email,
    });

    if (error) {
      console.error("Error changing email:", error);
      showError("Failed to update email: " + error.message);
    } else {
      showSuccess("Confirmation email sent! Please check your new email address to verify the change.");
      form.reset({ new_email: values.new_email });
    }
    setIsSubmitting(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="new_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Login Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="new-email@example.com" className="pl-10" {...field} />
                </div>
              </FormControl>
              <FormDescription>
                This is the email you use to sign in. You will need to confirm this change via email.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Email...
            </>
          ) : (
            "Update Login Email"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default ChangeEmailForm;