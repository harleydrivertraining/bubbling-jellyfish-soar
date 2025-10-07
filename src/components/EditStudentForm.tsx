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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, XCircle } from "lucide-react";

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
  existing_document_url: z.string().url().optional().nullable(), // To display existing document
});

interface EditStudentFormProps {
  studentId: string;
  onStudentUpdated: () => void;
  onStudentDeleted: () => void;
  onClose: () => void;
}

const EditStudentForm: React.FC<EditStudentFormProps> = ({ studentId, onStudentUpdated, onStudentDeleted, onClose }) => {
  const { user } = useSession();
  const [isLoadingStudent, setIsLoadingStudent] = useState(true);
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date_of_birth: "",
      driving_license_number: "",
      phone_number: "",
      full_address: "",
      notes: "",
      status: "Beginner", // Default to a valid enum value
      document: null,
      existing_document_url: null,
    },
  });

  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!user || !studentId) return;
      setIsLoadingStudent(true);
      const { data, error } = await supabase
        .from("students")
        .select("name, date_of_birth, driving_license_number, phone_number, full_address, notes, status, document_url")
        .eq("id", studentId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching student details:", error);
        showError("Failed to load student details: " + error.message);
        onClose();
      } else if (data) {
        // Ensure status is one of the valid enum values, fallback if not
        const validStatuses = ["Beginner", "Intermediate", "Advanced"];
        const studentStatus = validStatuses.includes(data.status as "Beginner" | "Intermediate" | "Advanced")
          ? data.status as "Beginner" | "Intermediate" | "Advanced"
          : "Beginner"; // Fallback to 'Beginner' if status is invalid

        // Convert YYYY-MM-DD from database to DD/MM/YYYY for display
        const formattedDobForDisplay = data.date_of_birth
          ? `${data.date_of_birth.split('-')[2]}/${data.date_of_birth.split('-')[1]}/${data.date_of_birth.split('-')[0]}`
          : "";

        form.reset({
          name: data.name,
          date_of_birth: formattedDobForDisplay,
          driving_license_number: data.driving_license_number || "",
          phone_number: data.phone_number || "",
          full_address: data.full_address || "",
          notes: data.notes || "",
          status: studentStatus, // Use the validated status
          document: null, // File input should always be reset
          existing_document_url: data.document_url,
        });
        setCurrentDocumentUrl(data.document_url);
      }
      setIsLoadingStudent(false);
    };

    fetchStudentDetails();
  }, [studentId, user, form, onClose]);

  const handleRemoveDocument = async () => {
    if (!user) {
      showError("You must be logged in to remove a document.");
      return;
    }
    if (!currentDocumentUrl) return;

    // Attempt to delete from storage if it's a Supabase storage URL
    if (currentDocumentUrl.includes('/storage/v1/object/public/student-documents/')) {
      const urlParts = currentDocumentUrl.split('/public/student-documents/');
      if (urlParts.length < 2) {
        showError("Could not determine file path from URL.");
        return;
      }
      const filePath = urlParts[1];

      const { error: deleteError } = await supabase.storage
        .from('student-documents')
        .remove([filePath]);

      if (deleteError) {
        console.error("Error deleting document from storage:", deleteError);
        showError("Failed to delete document from storage: " + deleteError.message);
        return;
      }
    }

    // Update student record in DB to null
    const { error: updateError } = await supabase
      .from('students')
      .update({ document_url: null })
      .eq('id', studentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error("Error removing document URL from DB:", updateError);
      showError("Failed to remove document URL from database: " + updateError.message);
    } else {
      showSuccess("Document removed successfully!");
      setCurrentDocumentUrl(null); // Clear local state
      form.setValue("existing_document_url", null);
      onStudentUpdated();
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update a student.");
      return;
    }

    let documentUrl: string | null = currentDocumentUrl; // Start with existing URL

    if (values.document && values.document.length > 0) {
      const file = values.document[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // If there was an old document, delete it first
      if (currentDocumentUrl && currentDocumentUrl.includes('/storage/v1/object/public/student-documents/')) {
        const oldFilePath = currentDocumentUrl.split('/public/student-documents/')[1];
        await supabase.storage.from('student-documents').remove([oldFilePath]);
      }

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

    const { error } = await supabase
      .from("students")
      .update({
        name: values.name,
        date_of_birth: formattedDobForSupabase,
        driving_license_number: values.driving_license_number,
        phone_number: values.phone_number,
        full_address: values.full_address,
        notes: values.notes,
        status: values.status,
        document_url: documentUrl,
      })
      .eq("id", studentId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating student:", error);
      showError("Failed to update student: " + error.message);
    } else {
      showSuccess("Student updated successfully!");
      onStudentUpdated();
    }
  };

  const handleDelete = async () => {
    if (!user) {
      showError("You must be logged in to delete a student.");
      return;
    }

    // Optionally delete document from storage before deleting student record
    if (currentDocumentUrl && currentDocumentUrl.includes('/storage/v1/object/public/student-documents/')) {
      const filePath = currentDocumentUrl.split('/public/student-documents/')[1];
      const { error: deleteFileError } = await supabase.storage
        .from('student-documents')
        .remove([filePath]);
      if (deleteFileError) {
        console.warn("Could not delete associated document from storage:", deleteFileError);
      }
    }

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting student:", error);
      showError("Failed to delete student: " + error.message);
    } else {
      showSuccess("Student deleted successfully!");
      onStudentDeleted();
    }
  };

  if (isLoadingStudent) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

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
                <FormLabel>Date of Birth</FormLabel>
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
        <FormItem>
          <FormLabel>Document (Optional)</FormLabel>
          {currentDocumentUrl && (
            <div className="flex items-center justify-between p-2 border rounded-md mb-2">
              <a href={currentDocumentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-500 hover:underline">
                <FileText className="h-4 w-4 mr-2" /> View Current Document
              </a>
              <Button variant="ghost" size="icon" onClick={handleRemoveDocument} title="Remove Document">
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
          <FormField
            control={form.control}
            name="document"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormControl>
                <Input
                  {...fieldProps}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={(event) => onChange(event.target.files)}
                />
              </FormControl>
            )}
          />
          <FormMessage />
          <p className="text-sm text-muted-foreground">Upload a new file to replace the existing one, or remove the current document.</p>
        </FormItem>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Update Student</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete Student</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this student and all associated data (lessons, progress, pre-paid hours, driving tests).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </form>
    </Form>
  );
};

export default EditStudentForm;