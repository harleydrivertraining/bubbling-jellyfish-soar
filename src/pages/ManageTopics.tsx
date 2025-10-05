"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ProgressTopic {
  id: string;
  name: string;
}

const ManageTopics: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [topics, setTopics] = useState<ProgressTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ProgressTopic | null>(null);
  const [topicName, setTopicName] = useState("");

  const fetchTopics = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("progress_topics")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching topics:", error);
      showError("Failed to load topics: " + error.message);
      setTopics([]);
    } else {
      setTopics(data || []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchTopics();
    }
  }, [isSessionLoading, fetchTopics]);

  const handleSaveTopic = async () => {
    if (!user) {
      showError("You must be logged in to manage topics.");
      return;
    }
    if (!topicName.trim()) {
      showError("Topic name cannot be empty.");
      return;
    }

    if (editingTopic) {
      // Update existing topic
      const { error } = await supabase
        .from("progress_topics")
        .update({ name: topicName })
        .eq("id", editingTopic.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating topic:", error);
        showError("Failed to update topic: " + error.message);
      } else {
        showSuccess("Topic updated successfully!");
        fetchTopics();
        setIsDialogOpen(false);
        setEditingTopic(null);
        setTopicName("");
      }
    } else {
      // Add new topic
      const { error } = await supabase
        .from("progress_topics")
        .insert({ user_id: user.id, name: topicName })
        .select();

      if (error) {
        console.error("Error adding topic:", error);
        showError("Failed to add topic: " + error.message);
      } else {
        showSuccess("Topic added successfully!");
        fetchTopics();
        setIsDialogOpen(false);
        setTopicName("");
      }
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (!user) {
      showError("You must be logged in to delete topics.");
      return;
    }

    const { error } = await supabase
      .from("progress_topics")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting topic:", error);
      showError("Failed to delete topic: " + error.message);
    } else {
      showSuccess("Topic deleted successfully!");
      fetchTopics();
    }
  };

  const openEditDialog = (topic: ProgressTopic) => {
    setEditingTopic(topic);
    setTopicName(topic.name);
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTopic(null);
    setTopicName("");
    setIsDialogOpen(true);
  };

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32 ml-auto" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Progress Topics</h1>
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Topic
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Custom Topics</CardTitle>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-muted-foreground">No topics added yet. Click "Add New Topic" to get started!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((topic) => (
                  <TableRow key={topic.id}>
                    <TableCell className="font-medium">{topic.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(topic)} className="mr-2">
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the topic "{topic.name}".
                              Any progress entries associated with this topic will also be affected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTopic(topic.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Edit Topic" : "Add New Topic"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="topicName" className="text-right">
                Topic Name
              </Label>
              <Input
                id="topicName"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <Button type="submit" onClick={handleSaveTopic}>
            {editingTopic ? "Save Changes" : "Add Topic"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageTopics;