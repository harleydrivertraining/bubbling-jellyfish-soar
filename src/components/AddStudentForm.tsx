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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";

// Helper function to calculate age
const calculateAge = (dobString: string | null | undefined): number | null => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null; // Invalid date

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Student name must be at least 2 characters.",
  }),
  date_of_birth: z.string()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true; // Allow null or empty string
      const date = new Date(val);
      return !isNaN(date.getTime()) && val.match(/^\d{4}-\d{2}-\d{2}$/); // Check if it's a valid date and YYYY-MM-DD format
    }, {
      message: "Invalid date format. Please use YYYY-MM-DD.",
    }),
  driving_license_number: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  full_address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["Beginner", "Intermediate", "Advanced"], {
    message: "Please select a valid status.",
  }),
  document: typeof window === 'undefined' ? z.any().optional().nullable() : z.instanceof(FileList).optional().nullable(),
});

interface AddStudentFormProps {
  onStudentAdded: () => void;
  onClose: () => void;
}

const AddStudentForm: React.FC<AddStudentFormProps> = ({ onStudentAdded, onClose }) => {
  const { user } = useSession();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date_of_birth: "",
      driving_license_number: "",
      phone_number: "",
      full_address: "",
      notes: "",
      status: "Beginner",
      document: null,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to add a student.");
      return;
    }

    let documentUrl: string | null = null;

    if (values.document && values.document.length > 0) {
      const file = values.document[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`; // Store in user-specific folder

      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading document:", uploadError);
        showError("Failed to upload document: " + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('student-documents')
        .getPublicUrl(filePath);
      
      documentUrl = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("students")
      .insert({
        user_id: user.id,
        name: values.name,
        date_of_birth: values.date_of_birth || null, // Pass string directly or null
        driving_license_number: values.driving_license_number,
        phone_number: values.phone_number,
        full_address: values.full_address,
        notes: values.notes,
        status: values.status,
        document_url: documentUrl,
      })
      .select();

    if (error) {
      console.error("Error adding student:", error);
      showError("Failed to add student: " + error.message);
    } else {
      showSuccess("Student added successfully!");
      form.reset();
      onStudentAdded();
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
              <FormLabel>Student Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date_of_birth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth (YYYY-MM-DD)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 2000-01-15" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>Current Age</FormLabel>
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
              {calculateAge(form.watch("date_of_birth")) !== null
                ? `${calculateAge(form.watch("date_of_birth"))} years`
                : "N/A"}
            </div>
          </FormItem>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="driving_license_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Driving License Number</FormLabel>
                <FormControl>
                  <Input placeholder="ABC12345DEF" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="full_address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St, Anytown, USA" {...field} />
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
              <FormLabel>Any Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., prefers morning lessons" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="document"
          render={({ field: { value, onChange, ...fieldProps } }) => (
            <FormItem>
              <FormLabel>Upload Document (Optional)</FormLabel>
              <FormControl>
                <Input
                  {...fieldProps}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={(event) => onChange(event.target.files)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">Add Student</Button>
      </form>
    </Form>
  );
};

export default AddStudentForm;