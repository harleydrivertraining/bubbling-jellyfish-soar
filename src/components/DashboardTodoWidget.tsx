"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, ListTodo, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DashboardTodoWidget: React.FC = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['instructor-todos-dashboard', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructor_todos")
        .select("*")
        .eq("user_id", user!.id)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (task: string) => {
      const { error } = await supabase
        .from("instructor_todos")
        .insert({ user_id: user!.id, task });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-todos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-todos'] });
      setNewTask("");
      setIsAddOpen(false);
      showSuccess("Task added!");
    },
    onError: (error: any) => showError("Failed to add task: " + error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("instructor_todos")
        .update({ completed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-todos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-todos'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("instructor_todos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-todos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-todos'] });
      showSuccess("Task removed.");
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    addMutation.mutate(newTask.trim());
  };

  return (
    <Card className="shadow-sm h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            To Do List
          </CardTitle>
          <div className="flex items-center gap-1">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAdd} className="flex gap-2 pt-4">
                  <Input 
                    placeholder="What needs to be done?" 
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" disabled={addMutation.isPending || !newTask.trim()}>
                    {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-primary">
              <Link to="/todo"><ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : todos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic text-sm">
            No active tasks.
          </div>
        ) : (
          <div className="divide-y">
            {todos.map((todo) => (
              <div key={todo.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox 
                    checked={todo.completed} 
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: todo.id, completed: !!checked })}
                  />
                  <span className="text-sm font-medium truncate">{todo.task}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMutation.mutate(todo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardTodoWidget;