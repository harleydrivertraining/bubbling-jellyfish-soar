"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Power, PowerOff, RefreshCw, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface RecurringExpenditure {
  id: string;
  amount: number;
  description: string;
  category: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

const ManageRecurringExpenditures: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
  const { user } = useSession();
  const [items, setItems] = useState<RecurringExpenditure[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("recurring_expenditures")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) showError("Failed to load recurring items.");
    else setItems(data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("recurring_expenditures")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) showError("Failed to update status.");
    else {
      showSuccess(`Recurring item ${!currentStatus ? 'activated' : 'paused'}.`);
      fetchItems();
      onUpdate();
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from("recurring_expenditures")
      .delete()
      .eq("id", id);

    if (error) showError("Failed to delete item.");
    else {
      showSuccess("Recurring item removed.");
      fetchItems();
      onUpdate();
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground italic">No recurring expenditures set up.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id} className={cn("overflow-hidden", !item.is_active && "opacity-60 grayscale")}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">{item.description}</p>
                    <Badge variant="outline" className="text-[10px] uppercase">{item.frequency}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground font-bold uppercase">
                    <span>{item.category}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <span>Starts {format(new Date(item.start_date), "MMM d, yyyy")}</span>
                      {item.end_date && (
                        <>
                          <ArrowRight className="h-2 w-2" />
                          <span>Ends {format(new Date(item.end_date), "MMM d, yyyy")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="font-black text-red-600">£{item.amount.toFixed(2)}</p>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className={cn("h-8 w-8", item.is_active ? "text-orange-600" : "text-green-600")}
                    onClick={() => toggleActive(item.id, item.is_active)}
                    title={item.is_active ? "Pause" : "Activate"}
                  >
                    {item.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default ManageRecurringExpenditures;