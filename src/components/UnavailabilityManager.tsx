"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, Plus, Calendar, Ban, Loader2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { showSuccess, showError } from "@/utils/toast";
import DatePicker from "@/components/DatePicker";
import { Skeleton } from "@/components/ui/skeleton";

const UnavailabilityManager = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['instructor-unavailability', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructor_unavailability")
        .select("*")
        .eq("user_id", user!.id)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) return;
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      
      const { error } = await supabase
        .from("instructor_unavailability")
        .insert({
          user_id: user!.id,
          start_date: formattedDate,
          end_date: formattedDate, // Set both to the same day for individual selection
          reason: reason.trim() || null
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-unavailability'] });
      queryClient.invalidateQueries({ queryKey: ['public-unavailability'] });
      setReason("");
      showSuccess("Restriction added for the selected day.");
    },
    onError: (err: any) => showError(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("instructor_unavailability")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-unavailability'] });
      queryClient.invalidateQueries({ queryKey: ['public-unavailability'] });
      showSuccess("Restriction removed.");
    }
  });

  return (
    <div className="space-y-6">
      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Add "No Test" Day
          </CardTitle>
          <CardDescription>
            Pick a specific day where you don't want students to book driving tests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Select Date</Label>
            <DatePicker date={selectedDate} setDate={setSelectedDate} />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase">Reason (Optional)</Label>
            <Input 
              placeholder="e.g., On holiday, Car in garage..." 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          
          <Button 
            className="w-full font-bold" 
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !selectedDate}
          >
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Add Restriction</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Active Restrictions
        </h3>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic p-4 border rounded-lg border-dashed text-center">
            No manual restrictions set.
          </p>
        ) : (
          <div className="grid gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm group">
                <div className="min-w-0">
                  <p className="font-bold text-sm">
                    {format(parseISO(item.start_date), "EEEE, MMM do, yyyy")}
                  </p>
                  {item.reason && <p className="text-xs text-muted-foreground truncate">{item.reason}</p>}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UnavailabilityManager;