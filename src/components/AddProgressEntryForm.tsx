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
import StarRatingInput from "@/components/StarRatingInput"; // Import the new StarRatingInput

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

interface AddProgressEntryFormProps {
  studentId: string;
  onEntryAdded: () => void;
  onClose: () => void;
}

const AddProgressEntryForm: React.FC<AddProgressEntryFormProps> = ({
  studentId,
  onEntryAdded,
  onClose,
}) => {
  const { user } = useSession();
  const [topics, setTopics] = useState<ProgressTopic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [openTopicSelect, setOpenTopicSelect] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic_id: "",
      rating: 3, // Default rating
      comment: "",
      targets: "",
    },
  });

  useEffect(() => {
    const fetchTopics = async () => {
      if (!user) return;
      setIsLoadingTopics(true);
      const { data, error } = await supabase
        .from("progress_topics")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching topics for progress entry form:", error);
        showError("Failed to load topics: " + error.message);
        setTopics([]);
      } else {
        setTopics(data || []);
      }
      setIsLoadingTopics(false);
    };

    fetchTopics();
  }, [user]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to add a progress entry.");
      return;
    }

    const { error } = await supabase
      .from("student_progress_entries")
      .insert({
        user_id: user.id,
        student_id: studentId,
        topic_id: values.topic_id,
        rating: values.rating,
        comment: values.comment,
        targets: values.targets,
      })
      .select();

    if (error) {
      console.error("Error adding progress entry:", error);
      showError("Failed to add progress entry: " + error.message);
    } else {
      showSuccess("Progress entry added successfully!");
      form.reset();
      onEntryAdded();
      onClose();
    }
  };

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

        <Button type="submit" className="w-full">Add Progress Entry</Button>
      </form>
    </Form>
  );
};

export default AddProgressEntryForm;