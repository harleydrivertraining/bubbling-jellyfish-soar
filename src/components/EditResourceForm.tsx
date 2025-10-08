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
import { Link as LinkIcon, Image as ImageIcon, Check, ChevronsUpDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ResourceFolder {
  id: string;
  name: string;
}

const formSchema = z.object({
  name: z.string().min(1, { message: "Resource name is required." }),
  image_url: z.string().url({ message: "Must be a valid URL." }).optional().nullable().or(z.literal("")),
  details: z.string().optional().nullable(),
  resource_url: z.string().url({ message: "Resource URL is required and must be a valid URL." }),
  folder_id: z.string().optional().nullable(), // New field for folder_id
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      image_url: "",
      details: "",
      resource_url: "",
      folder_id: null,
    },
  });

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
        .select("name, image_url, details, resource_url, folder_id") // Select folder_id
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
          resource_url: data.resource_url,
          folder_id: data.folder_id || null, // Set folder_id
        });
      }
      setIsLoadingResource(false);
    };

    fetchResourceDetails();
  }, [resourceId, user, form, onClose]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update a resource.");
      return;
    }

    const { error } = await supabase
      .from("resources")
      .update({
        name: values.name,
        image_url: values.image_url === "" ? null : values.image_url,
        details: values.details,
        resource_url: values.resource_url,
        folder_id: values.folder_id === "" ? null : values.folder_id, // Update folder_id
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
          <Button type="submit" className="flex-1">Update Resource</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete Resource</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this resource.
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