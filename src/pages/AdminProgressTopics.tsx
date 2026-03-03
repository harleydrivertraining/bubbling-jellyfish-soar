"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Link, useNavigate } from "react-router-dom";

interface ProgressTopic {
  id: string;
  name: string;
  is_default: boolean;
}

const AdminProgressTopics: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<ProgressTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ProgressTopic | null>(null);
  const [topicName, setTopicName] = useState("");

  const fetchDefaultTopics = useCallback(async () => {
    if (!user) return;
    
    // Verify owner role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (profile?.role !== 'owner') {
      navigate("/manage-topics");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("progress_topics")
      .select("id, name, is_default")
      .eq("is_default", true)
      .order("name", { ascending: true });

    if (error) {
      showError("Failed to load default topics: " + error.message);
    } else {
      setTopics(data || []);
    }
    setIsLoading(false);
  }, [user, navigate]);

  useEffect(() => {
    if (!isSessionLoading) fetchDefaultTopics();
  }, [isSessionLoading, fetchDefaultTopics]);

  const handleSaveTopic = async () => {
    if (!user) return;
    if (!topicName.trim()) {
      showError("Topic name cannot be empty.");
      return;
    }

    if (editingTopic) {
      const { error } = await supabase
        .from("progress_topics")
        .update({ name: topicName })
        .eq("id", editingTopic.id);

      if (error) showError("Failed to update topic: " + error.message);
      else {
        showSuccess("Default topic updated!");
        fetchDefaultTopics();
        setIsDialogOpen(false);
      }
    } else {
      const { error } = await supabase
        .from("progress_topics")
        .insert({ 
          user_id: user.id, 
          name: topicName, 
          is_default: true 
        });

      if (error) showError("Failed to add topic: " + error.message);
      else {
        showSuccess("Default topic added!");
        fetchDefaultTopics();
        setIsDialogOpen(false);
      }
    }
  };

  const handleDeleteTopic = async (id: string) => {
    const { error } = await supabase
      .from("progress_topics")
      .delete()
      .eq("id", id);

    if (error) showError("Failed to delete topic: " + error.message);
    else {
      showSuccess("Default topic removed.");
      fetchDefaultTopics();
    }
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="-ml-2">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Default Progress Topics
          </h1>
        </div>
        <Button onClick={() => { setEditingTopic(null); setTopicName(""); setIsDialogOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Default
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Default Topics</CardTitle>
          <CardDescription>These topics will be available to ALL instructors on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No default topics defined yet.</p>
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
                    <TableCell className="font-bold">{topic.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingTopic(topic); setTopicName(topic.name); setIsDialogOpen(true); }} className="mr-2">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Default Topic?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove "{topic.name}" from all instructors' lists. Existing student progress entries for this topic will remain but the topic name may become unavailable.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTopic(topic.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Edit Default Topic" : "Add Default Topic"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Topic Name</Label>
              <Input id="name" value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="e.g., Parallel Parking" />
            </div>
            <Button className="w-full" onClick={handleSaveTopic}>Save Default Topic</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProgressTopics;