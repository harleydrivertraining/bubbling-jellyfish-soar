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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StarRatingInput from "@/components/StarRatingInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface ProgressTopic {
  id: string;
  name: string;
}

const formSchema = z.object({
  topic_id: z.string().min(1, { message: "Please select a topic." }),
  rating: z.number().min(1).max(5, { message: "Rating must be between 1 and 5 stars." }),
  comment: z.string().optional().nullable(),
  targets: z.string().optional().nullable(),
});

interface EditProgressEntryFormProps {
  entryId: string;
  onEntryUpdated: () => void;
  onEntryDeleted: () => void;
  onClose: () => void;
}

const EditProgressEntryForm: React.FC<EditProgressEntryFormProps> = ({
  entryId,
  onEntryUpdated,
  onEntryDeleted,
  onClose,
}) => {
  const { user } = useSession();
  const [topics, setTopics] = useState<ProgressTopic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isLoadingEntry, setIsLoadingEntry] = useState(true);
  const [openTopicSelect, setOpenTopicSelect] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic_id: "",
      rating: 3,
      comment: "",
      targets: "",
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoadingTopics(true);
      const { data: topicData, error: topicError } = await supabase
        .from("progress_topics")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (topicError) {
        console.error("Error fetching topics for edit progress entry form:", topicError);
        showError("Failed to load topics: " + topicError.message);
        setTopics([]);
      } else {
        setTopics(topicData || []);
      }
      setIsLoadingTopics(false);

      setIsLoadingEntry(true);
      const { data: entryData, error: entryError } = await supabase
        .from("student_progress_entries")
        .select("*, progress_topics(name)")
        .eq("id", entryId)
        .eq("user_id", user.id)
        .single();

      if (entryError) {
        console.error("Error fetching progress entry details:", entryError);
        showError("Failed to load progress entry details: " + entryError.message);
        onClose();
      } else if (entryData) {
        form.reset({
          topic_id: entryData.topic_id,
          rating: entryData.rating,
          comment: entryData.comment || "",
          targets: entryData.targets || "",
        });
      }
      setIsLoadingEntry(false);
    };

    fetchData();
  }, [entryId, user, form, onClose]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update a progress entry.");
      return;
    }

    const { error } = await supabase
      .from("student_progress_entries")
      .update({
        topic_id: values.topic_id,
        rating: values.rating,
        comment: values.comment,
        targets: values.targets,
      })
      .eq("id", entryId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating progress entry:", error);
      showError("Failed to update progress entry: " + error.message);
    } else {
      showSuccess("Progress entry updated successfully!");
      onEntryUpdated();
    }
  };

  const handleDelete = async () => {
    if (!user) {
      showError("You must be logged in to delete a progress entry.");
      return;
    }

    const { error } = await supabase
      .from("student_progress_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting progress entry:", error);
      showError("Failed to delete progress entry: " + error.message);
    } else {
      showSuccess("Progress entry deleted successfully!");
      onEntryDeleted();
    }
  };

  if (isLoadingEntry || isLoadingTopics) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="topic_id"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Topic</FormLabel>
              <Popover open={openTopicSelect} onOpenChange={setOpenTopicSelect}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isLoadingTopics}
                    >
                      {field.value
                        ? topics.find((topic) => topic.id === field.value)?.name
                        : "Select a topic"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search topic..." />
                    <CommandEmpty>No topic found. Go to 'Manage Topics' to add some!</CommandEmpty>
                    <CommandGroup>
                      {topics.map((topic) => (
                        <CommandItem
                          value={topic.name}
                          key={topic.id}
                          onSelect={() => {
                            form.setValue("topic_id", topic.id);
                            setOpenTopicSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              topic.id === field.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {topic.name}
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

        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rating (1-5 Stars)</FormLabel>
              <FormControl>
                <StarRatingInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comment (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Student showed great improvement in this area." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targets"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Targets for Next Session (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Focus on maintaining speed on turns." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Update Entry</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete Entry</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this progress entry.
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

export default EditProgressEntryForm;