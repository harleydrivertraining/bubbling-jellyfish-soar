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
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link as LinkIcon, Image as ImageIcon, Check, ChevronsUpDown, UploadCloud, XCircle, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } = "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface ResourceFolder {
  id: string;
  name: string;
}

const formSchema = z.object({
  name: z.string().min(1, { message: "Resource name is required." }),
  image_url: z.string().url({ message: "Must be a valid URL." }).optional().nullable().or(z.literal("")),
  details: z.string().optional().nullable(),
  resource_url: z.string().url({ message: "Resource URL is required and must be a valid URL." }).optional().nullable().or(z.literal("")),
  file: typeof window === 'undefined' ? z.any().optional().nullable() : z.instanceof(FileList).optional().nullable(),
  folder_id: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.resource_url && (!data.file || data.file.length === 0) && !data.existing_file_path) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either a Resource URL or a File must be provided.",
      path: ["resource_url"],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either a Resource URL or a File must be provided.",
      path: ["file"],
    });
  }
});

interface EditResourceFormProps {
  resourceId: string;
  onResourceUpdated: () => void;
  onResourceDeleted: () => void;
  onClose: () => void;
}

const EditResourceForm: React.FC<EditResourceFormProps> = ({ resourceId, onResourceUpdated, onResourceDeleted, onClose }) => {
  const { user } = useSession();
  const [isLoadingResource, setIsLoadingResource] = useState(true);
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [openFolderSelect, setOpenFolderSelect] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      image_url: "",
      details: "",
      resource_url: "",
      file: null,
      folder_id: null,
    },
  });

  const selectedFile = form.watch("file");
  const resourceUrl = form.watch("resource_url");

  useEffect(() => {
    if (selectedFile && selectedFile.length > 0) {
      setFilePreview(URL.createObjectURL(selectedFile[0]));
      form.setValue("resource_url", ""); // Clear URL if new file is selected
    } else if (existingFilePath) {
      setFilePreview(existingFilePath); // Show existing file preview
    } else {
      setFilePreview(null);
    }
    return () => {
      if (filePreview && filePreview.startsWith("blob:")) URL.revokeObjectURL(filePreview);
    };
  }, [selectedFile, existingFilePath, form, filePreview]);

  useEffect(() => {
    const fetchFolders = async () => {
      if (!user) return;
      setIsLoadingFolders(true);
      const { data, error } = await supabase
        .from("resource_folders")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching folders for resource form:", error);
        showError("Failed to load folders: " + error.message);
        setFolders([]);
      } else {
        setFolders(data || []);
      }
      setIsLoadingFolders(false);
    };

    fetchFolders();
  }, [user]);

  useEffect(() => {
    const fetchResourceDetails = async () => {
      if (!user || !resourceId) return;
      setIsLoadingResource(true);
      const { data, error } = await supabase
        .from("resources")
        .select("name, image_url, details, resource_url, file_path, folder_id")
        .eq("id", resourceId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching resource details:", error);
        showError("Failed to load resource details: " + error.message);
        onClose();
      } else if (data) {
        form.reset({
          name: data.name,
          image_url: data.image_url || "",
          details: data.details || "",
          resource_url: data.resource_url || "",
          folder_id: data.folder_id || null,
          file: null, // Always reset file input
        });
        setExistingFilePath(data.file_path);
      }
      setIsLoadingResource(false);
    };

    fetchResourceDetails();
  }, [resourceId, user, form, onClose]);

  const handleRemoveFile = async () => {
    if (!user) {
      showError("You must be logged in to remove a file.");
      return;
    }
    if (!existingFilePath) return;

    // Attempt to delete from storage if it's a Supabase storage URL
    if (existingFilePath.includes('/storage/v1/object/public/resources/')) {
      const urlParts = existingFilePath.split('/public/resources/');
      if (urlParts.length < 2) {
        showError("Could not determine file path from URL.");
        return;
      }
      const filePathInStorage = urlParts[1];

      const { error: deleteError } = await supabase.storage
        .from('resources')
        .remove([filePathInStorage]);

      if (deleteError) {
        console.error("Error deleting file from storage:", deleteError);
        showError("Failed to delete file from storage: " + deleteError.message);
        return;
      }
    }

    // Update resource record in DB to null for file_path
    const { error: updateError } = await supabase
      .from('resources')
      .update({ file_path: null })
      .eq('id', resourceId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error("Error removing file path from DB:", updateError);
      showError("Failed to remove file path from database: " + updateError.message);
    } else {
      showSuccess("File removed successfully!");
      setExistingFilePath(null);
      setFilePreview(null);
      onResourceUpdated();
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update a resource.");
      return;
    }

    let finalResourceUrl: string | null = values.resource_url === "" ? null : values.resource_url;
    let finalFilePath: string | null = existingFilePath; // Start with existing file path

    if (values.file && values.file.length > 0) {
      setUploading(true);
      setUploadProgress(0);
      const file = values.file[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      // If there was an old file, delete it first from storage
      if (existingFilePath && existingFilePath.includes('/storage/v1/object/public/resources/')) {
        const oldFilePathInStorage = existingFilePath.split('/public/resources/')[1];
        await supabase.storage.from('resources').remove([oldFilePathInStorage]);
      }

      const { data, error: uploadError } = await supabase.storage
        .from('resources')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (event) => {
            if (event.totalBytes > 0) {
              setUploadProgress(Math.round((event.bytesUploaded / event.totalBytes) * 100));
            }
          },
        });

      if (uploadError) {
        console.error("Error uploading resource file:", uploadError);
        showError("Failed to upload file: " + uploadError.message);
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('resources')
        .getPublicUrl(filePath);
      
      finalFilePath = publicUrlData.publicUrl;
      finalResourceUrl = null; // Clear external URL if a file is uploaded
      setUploading(false);
      setUploadProgress(0);
    } else if (finalResourceUrl) {
      // If an external URL is provided and no new file is uploaded, clear file_path
      finalFilePath = null;
      // If there was an old file, delete it from storage
      if (existingFilePath && existingFilePath.includes('/storage/v1/object/public/resources/')) {
        const oldFilePathInStorage = existingFilePath.split('/public/resources/')[1];
        await supabase.storage.from('resources').remove([oldFilePathInStorage]);
      }
    } else if (!finalResourceUrl && !finalFilePath) {
      // This case should be caught by superRefine, but as a fallback
      showError("Either a Resource URL or a File must be provided.");
      return;
    }

    const { error } = await supabase
      .from("resources")
      .update({
        name: values.name,
        image_url: values.image_url === "" ? null : values.image_url,
        details: values.details,
        resource_url: finalResourceUrl,
        file_path: finalFilePath, // Update with new file path or null
        folder_id: values.folder_id === "" ? null : values.folder_id,
      })
      .eq("id", resourceId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating resource:", error);
      showError("Failed to update resource: " + error.message);
    } else {
      showSuccess("Resource updated successfully!");
      onResourceUpdated();
    }
  };

  const handleDelete = async () => {
    if (!user) {
      showError("You must be logged in to delete a resource.");
      return;
    }

    // Optionally delete file from storage before deleting resource record
    if (existingFilePath && existingFilePath.includes('/storage/v1/object/public/resources/')) {
      const filePathInStorage = existingFilePath.split('/public/resources/')[1];
      const { error: deleteFileError } = await supabase.storage
        .from('resources')
        .remove([filePathInStorage]);
      if (deleteFileError) {
        console.warn("Could not delete associated file from storage:", deleteFileError);
      }
    }

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", resourceId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting resource:", error);
      showError("Failed to delete resource: " + error.message);
    } else {
      showSuccess("Resource deleted successfully!");
      onResourceDeleted();
    }
  };

  if (isLoadingResource || isLoadingFolders) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
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

        <div className="space-y-2">
          {(existingFilePath || filePreview) && (
            <FormItem>
              <FormLabel>Current File</FormLabel>
              <div className="flex items-center justify-between p-2 border rounded-md mb-2">
                <a href={existingFilePath || filePreview || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-500 hover:underline">
                  <FileText className="h-4 w-4 mr-2" /> View Current File
                </a>
                <Button variant="ghost" size="icon" onClick={handleRemoveFile} title="Remove File">
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </FormItem>
          )}

          <FormField
            control={form.control}
            name="resource_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resource URL (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://www.gov.uk/highway-code"
                    {...field}
                    value={field.value || ""}
                    disabled={uploading || (selectedFile && selectedFile.length > 0) || !!existingFilePath} // Disable if file is selected/exists or uploading
                    onChange={(e) => {
                      field.onChange(e);
                      if (e.target.value) {
                        form.setValue("file", null); // Clear file input if URL is entered
                        setExistingFilePath(null); // Clear existing file path if URL is entered
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-muted-foreground/20"></div>
            <span className="flex-shrink mx-4 text-muted-foreground text-sm">OR</span>
            <div className="flex-grow border-t border-muted-foreground/20"></div>
          </div>

          <FormField
            control={form.control}
            name="file"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                <FormLabel>Upload New File (Optional)</FormLabel>
                <FormControl>
                  <Input
                    {...fieldProps}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.png,.mp4,.mov"
                    onChange={(event) => {
                      onChange(event.target.files);
                      if (event.target.files && event.target.files.length > 0) {
                        form.setValue("resource_url", ""); // Clear URL if file is selected
                      }
                    }}
                    disabled={uploading || (resourceUrl && resourceUrl.length > 0) || !!existingFilePath} // Disable if URL is entered/exists or uploading
                  />
                </FormControl>
                <FormMessage />
                {selectedFile && selectedFile.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{selectedFile?.[0]?.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => form.setValue("file", null)}
                      className="h-6 w-6 text-destructive hover:text-destructive/90"
                      title="Remove selected file"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {uploading && <Progress value={uploadProgress} className="w-full mt-2" />}
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="folder_id"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Folder (Optional)</FormLabel>
              <Popover open={openFolderSelect} onOpenChange={setOpenFolderSelect}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isLoadingFolders}
                    >
                      {field.value
                        ? folders.find((folder) => folder.id === field.value)?.name
                        : "Select a folder"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search folder..." />
                    <CommandEmpty>No folder found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="no-folder"
                        onSelect={() => {
                          form.setValue("folder_id", null);
                          setOpenFolderSelect(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            field.value === null ? "opacity-100" : "opacity-0"
                          )}
                        />
                        No Folder
                      </CommandItem>
                      {folders.map((folder) => (
                        <CommandItem
                          value={folder.name}
                          key={folder.id}
                          onSelect={() => {
                            form.setValue("folder_id", folder.id);
                            setOpenFolderSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              folder.id === field.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {folder.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={uploading}>Update Resource</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete Resource</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the resource "{form.watch("name")}" and any associated file from storage.
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

export default EditResourceForm;