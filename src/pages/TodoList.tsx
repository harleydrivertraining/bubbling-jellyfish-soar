"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, ListTodo, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  task: string;
  completed: boolean;
  created_at: string;
}

const TodoList: React.FC = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['instructor-todos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructor_todos")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Todo[];
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
      queryClient.invalidateQueries({ queryKey: ['instructor-todos'] });
      setNewTask("");
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
      queryClient.invalidateQueries({ queryKey: ['instructor-todos'] });
      showSuccess("Task removed.");
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    addMutation.mutate(newTask.trim());
  };

  if (isLoading) {
    return <div className="p-6 space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <ListTodo className="h-8 w-8 text-primary" />
          To Do List
        </h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Add New Task</CardTitle>
          <CardDescription>Keep track of your administrative duties and reminders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input 
              placeholder="e.g., Call DVSA about test booking..." 
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              disabled={addMutation.isPending}
            />
            <Button type="submit" disabled={addMutation.isPending || !newTask.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
            <Circle className="h-3 w-3 text-orange-500 fill-orange-500" />
            Active Tasks ({activeTodos.length})
          </h3>
          {activeTodos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-4 bg-muted/20 rounded-lg border border-dashed">No active tasks. You're all caught up!</p>
          ) : (
            <div className="grid gap-2">
              {activeTodos.map((todo) => (
                <Card key={todo.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
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
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(todo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {completedTodos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Completed
            </h3>
            <div className="grid gap-2 opacity-60">
              {completedTodos.map((todo) => (
                <Card key={todo.id} className="bg-muted/50">
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox 
                        checked={todo.completed} 
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: todo.id, completed: !!checked })}
                      />
                      <span className="text-sm font-medium line-through truncate">{todo.task}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(todo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;