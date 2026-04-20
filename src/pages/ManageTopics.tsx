"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, ShieldCheck, EyeOff, RotateCcw, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProgressTopic {
  id: string;
  name: string;
  is_default: boolean;
}

const ManageTopics: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [topics, setTopics] = useState<ProgressTopic[]>([]);
  const [hiddenTopicIds, setHiddenTopicIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ProgressTopic | null>(null);
  const [topicName, setTopicName] = useState("");

  const fetchTopics = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // 1. Fetch topics
      const { data: topicsData, error: topicsError } = await supabase
        .from("progress_topics")
        .select("id, name, is_default")
        .or(`user_id.eq.${user.id},is_default.eq.true`);

      // 2. Fetch hidden topic IDs
      const { data: hiddenData, error: hiddenError } = await supabase
        .from("hidden_progress_topics")
        .select("topic_id")
        .eq("user_id", user.id);

      // 3. Fetch custom order
      const { data: orderData } = await supabase
        .from("user_topic_orders")
        .select("topic_id, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (topicsError || hiddenError) throw new Error("Failed to load topics.");

      const hiddenIds = new Set((hiddenData || []).map(h => h.topic_id));
      setHiddenTopicIds(hiddenIds);

      // Sort topics based on saved order, then by default status, then by name
      const orderMap = new Map((orderData || []).map(o => [o.topic_id, o.sort_order]));
      
      const sortedTopics = (topicsData || []).sort((a, b) => {
        const orderA = orderMap.get(a.id);
        const orderB = orderMap.get(b.id);

        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;

        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setTopics(sortedTopics);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchTopics();
    }
  }, [isSessionLoading, fetchTopics]);

  const saveOrder = async (newTopics: ProgressTopic[]) => {
    if (!user) return;
    setIsSavingOrder(true);
    
    const visibleTopics = newTopics.filter(t => !hiddenTopicIds.has(t.id));
    const orderData = visibleTopics.map((t, index) => ({
      user_id: user.id,
      topic_id: t.id,
      sort_order: index
    }));

    const { error } = await supabase
      .from("user_topic_orders")
      .upsert(orderData, { onConflict: 'user_id,topic_id' });

    if (error) showError("Failed to save order.");
    setIsSavingOrder(false);
  };

  const moveTopic = (index: number, direction: 'up' | 'down') => {
    const newTopics = [...topics];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newTopics.length) {
      [newTopics[index], newTopics[targetIndex]] = [newTopics[targetIndex], newTopics[index]];
      setTopics(newTopics);
      saveOrder(newTopics);
    }
  };

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
        .eq("id", editingTopic.id)
        .eq("user_id", user.id);

      if (error) showError("Failed to update topic: " + error.message);
      else {
        showSuccess("Topic updated!");
        fetchTopics();
        setIsDialogOpen(false);
      }
    } else {
      const { error } = await supabase
        .from("progress_topics")
        .insert({ user_id: user.id, name: topicName, is_default: false });

      if (error) showError("Failed to add topic: " + error.message);
      else {
        showSuccess("Topic added!");
        fetchTopics();
        setIsDialogOpen(false);
      }
    }
  };

  const handleDeleteTopic = async (id: string) => {
    const { error } = await supabase
      .from("progress_topics")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) showError("Failed to delete topic: " + error.message);
    else {
      showSuccess("Topic deleted!");
      fetchTopics();
    }
  };

  const handleHideTopic = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("hidden_progress_topics")
      .insert({ user_id: user.id, topic_id: id });

    if (error) showError("Failed to hide topic.");
    else {
      showSuccess("Topic hidden from your list.");
      fetchTopics();
    }
  };

  const handleRestoreTopic = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("hidden_progress_topics")
      .delete()
      .eq("user_id", user.id)
      .eq("topic_id", id);

    if (error) showError("Failed to restore topic.");
    else {
      showSuccess("Topic restored to your list.");
      fetchTopics();
    }
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  const visibleTopics = topics.filter(t => !hiddenTopicIds.has(t.id));
  const hiddenTopics = topics.filter(t => hiddenTopicIds.has(t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Manage Progress Topics</h1>
          {isSavingOrder && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving Order...
            </div>
          )}
        </div>
        <Button onClick={() => { setEditingTopic(null); setTopicName(""); setIsDialogOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Topic
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="active" className="font-bold">Active Topics ({visibleTopics.length})</TabsTrigger>
          <TabsTrigger value="hidden" className="font-bold">Hidden Defaults ({hiddenTopics.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Active Topics</CardTitle>
              <CardDescription>Topics available when tracking student progress. Use arrows to reorder.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Order</TableHead>
                    <TableHead>Topic Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTopics.map((topic, index) => (
                    <TableRow key={topic.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            disabled={index === 0 || isSavingOrder}
                            onClick={() => moveTopic(index, 'up')}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            disabled={index === visibleTopics.length - 1 || isSavingOrder}
                            onClick={() => moveTopic(index, 'down')}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{topic.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {topic.is_default ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                            <ShieldCheck className="mr-1 h-3 w-3" /> Default
                          </Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {topic.is_default ? (
                            <Button variant="ghost" size="icon" onClick={() => handleHideTopic(topic.id)} title="Hide from my list">
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => { setEditingTopic(topic); setTopicName(topic.name); setIsDialogOpen(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Topic?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently remove this custom topic.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteTopic(topic.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hidden" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hidden Default Topics</CardTitle>
              <CardDescription>Default topics you've removed from your active list.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {hiddenTopics.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground italic">No hidden topics.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic Name</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hiddenTopics.map((topic) => (
                      <TableRow key={topic.id}>
                        <TableCell className="font-medium text-muted-foreground">{topic.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleRestoreTopic(topic.id)} className="font-bold">
                            <RotateCcw className="mr-2 h-4 w-4" /> Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Edit Topic" : "Add Custom Topic"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topicName">Topic Name</Label>
              <Input id="topicName" value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="e.g., Roundabouts" />
            </div>
            <Button className="w-full font-bold" onClick={handleSaveTopic}>Save Topic</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageTopics;