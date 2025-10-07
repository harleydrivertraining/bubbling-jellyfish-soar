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

  // Parse DD/MM/YYYY string
  const parts = dobString.split('/');
  if (parts.length !== 3) return null; // Invalid format

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);

  const dob = new Date(year, month, day);

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
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/; // DD/MM/YYYY format
      if (!dateRegex.test(val)) return false;

      const parts = val.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);

      // Basic date validity check
      if (month < 1 || month > 12 || day < 1 || day > 31) return false;
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }, {
      message: "Invalid date format. Please use DD/MM/YYYY.",
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

    // Convert DD/MM/YYYY to YYYY-MM-DD for database storage
    const formattedDobForSupabase = values.date_of_birth
      ? `${values.date_of_birth.split('/')[2]}-${values.date_of_birth.split('/')[1]}-${values.date_of_birth.split('/')[0]}`
      : null;

    const { data, error } = await supabase
      .from("students")
      .insert({
        user_id: user.id,
        name: values.name,
        date_of_birth: formattedDobForSupabase,
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
                <FormLabel>Date of Birth (DD/MM/YYYY)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 15/01/2000" {...field} value={field.value || ""} />
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