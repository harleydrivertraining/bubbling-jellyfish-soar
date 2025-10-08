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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link as LinkIcon, Image as ImageIcon } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, { message: "Resource name is required." }),
  image_url: z.string().url({ message: "Must be a valid URL." }).optional().nullable().or(z.literal("")),
  details: z.string().optional().nullable(),
  resource_url: z.string().url({ message: "Resource URL is required and must be a valid URL." }),
});

interface AddResourceFormProps {
  onResourceAdded: () => void;
  onClose: () => void;
}

const AddResourceForm: React.FC<AddResourceFormProps> = ({ onResourceAdded, onClose }) => {
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      image_url: "",
      details: "",
      resource_url: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to add a resource.");
      return;
    }

    const { error } = await supabase
      .from("resources")
      .insert({
        user_id: user.id,
        name: values.name,
        image_url: values.image_url === "" ? null : values.image_url,
        details: values.details,
        resource_url: values.resource_url,
      })
      .select();

    if (error) {
      console.error("Error adding resource:", error);
      showError("Failed to add resource: " + error.message);
    } else {
      showSuccess("Resource added successfully!");
      form.reset();
      onResourceAdded();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resource Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Highway Code" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resource Image URL (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/image.jpg" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
              {field.value && (
                <div className="mt-2 flex justify-center">
                  <Avatar className="h-20 w-20 rounded-lg border">
                    <AvatarImage src={field.value} alt="Resource Image Preview" className="object-cover" />
                    <AvatarFallback className="rounded-lg">
                      <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="details"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resource Details (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="A brief description of the resource." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="resource_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resource URL</FormLabel>
              <FormControl>
                <Input placeholder="https://www.gov.uk/highway-code" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Add Resource</Button>
      </form>
    </Form>
  );
};

export default AddResourceForm;