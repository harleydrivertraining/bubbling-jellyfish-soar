"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Car, CalendarDays, Gauge, MessageSquareText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import { enUS } from 'date-fns/locale';
import AddMileageEntryForm from "@/components/AddMileageEntryForm";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MileageEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD
  start_mileage: number;
  end_mileage: number;
  notes?: string;
  miles_driven: number;
}

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalMiles: number;
  entries: MileageEntry[];
}

const MileageTracker: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [allMileageEntries, setAllMileageEntries] = useState<MileageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMileageEntries = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("car_mileage_entries")
      .select("id, entry_date, start_mileage, end_mileage, notes")
      .eq("user_id", user.id)
      .order("entry_date", { ascending: false });

    if (error) {
      console.error("Error fetching mileage entries:", error);
      showError("Failed to load mileage entries: " + error.message);
      setAllMileageEntries([]);
    } else {
      const formattedEntries: MileageEntry[] = (data || []).map(entry => ({
        ...entry,
        miles_driven: entry.end_mileage - entry.start_mileage,
      }));
      setAllMileageEntries(formattedEntries);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchMileageEntries();
    }
  }, [isSessionLoading, fetchMileageEntries]);

  const handleEntryAdded = () => {
    fetchMileageEntries();
    setIsAddEntryDialogOpen(false);
  };

  const handleCloseAddEntryDialog = () => {
    setIsAddEntryDialogOpen(false);
  };

  const groupedAndFilteredEntries = useMemo(() => {
    const grouped: { [key: string]: WeeklySummary } = {};
    const now = new Date();

    const filtered = allMileageEntries.filter(entry => {
      const entryDate = parseISO(entry.entry_date);
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      return (
        entry.notes?.toLowerCase().includes(lowerCaseSearchTerm) ||
        entry.start_mileage.toString().includes(lowerCaseSearchTerm) ||
        entry.end_mileage.toString().includes(lowerCaseSearchTerm) ||
        format(entryDate, "PPP").toLowerCase().includes(lowerCaseSearchTerm)
      );
    });

    filtered.forEach(entry => {
      const entryDate = parseISO(entry.entry_date);
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1, locale: enUS }); // Monday as start of week
      const weekEnd = endOfWeek(entryDate, { weekStartsOn: 1, locale: enUS });
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!grouped[weekKey]) {
        grouped[weekKey] = {
          weekStart: format(weekStart, "PPP"),
          weekEnd: format(weekEnd, "PPP"),
          totalMiles: 0,
          entries: [],
        };
      }
      grouped[weekKey].totalMiles += entry.miles_driven;
      grouped[weekKey].entries.push(entry);
    });

    // Sort weeks from most recent to oldest
    const sortedWeeks = Object.values(grouped).sort((a, b) => {
      return parseISO(b.weekStart).getTime() - parseISO(a.weekStart).getTime();
    });

    return sortedWeeks;
  }, [allMileageEntries, searchTerm]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mileage Tracker</h1>
        <Dialog open={isAddEntryDialogOpen} onOpenChange={setIsAddEntryDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Mileage Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Mileage Entry</DialogTitle>
            </DialogHeader>
            <AddMileageEntryForm onEntryAdded={handleEntryAdded} onClose={handleCloseAddEntryDialog} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Miles This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {groupedAndFilteredEntries.length > 0 && isWithinInterval(parseISO(groupedAndFilteredEntries[0].weekStart), { start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) })
                ? groupedAndFilteredEntries[0].totalMiles.toFixed(1)
                : "0.0"}
              <span className="text-xl text-muted-foreground ml-2">miles</span>
            </p>
          </CardContent>
        </Card>
        {/* Add more summary cards here if needed, e.g., total miles all time */}
      </div>

      <Input
        placeholder="Search entries by date, mileage, or notes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      {groupedAndFilteredEntries.length === 0 && allMileageEntries.length > 0 && (
        <p className="text-muted-foreground col-span-full">No mileage entries match your search criteria.</p>
      )}
      {allMileageEntries.length === 0 ? (
        <p className="text-muted-foreground">No mileage entries recorded yet. Click "Add Mileage Entry" to get started!</p>
      ) : (
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            {groupedAndFilteredEntries.map((weeklySummary) => (
              <Card key={weeklySummary.weekStart}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-semibold flex items-center">
                    <CalendarDays className="mr-2 h-5 w-5 text-muted-foreground" />
                    Week of {weeklySummary.weekStart} - {weeklySummary.weekEnd}
                  </CardTitle>
                  <div className="flex items-center text-primary font-bold text-xl">
                    <Gauge className="mr-2 h-5 w-5" />
                    <span>{weeklySummary.totalMiles.toFixed(1)} miles</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {weeklySummary.entries.map((entry) => (
                    <div key={entry.id} className="border-t pt-3 first:border-t-0 first:pt-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{format(parseISO(entry.entry_date), "PPP")}</span>
                        <span className="text-muted-foreground">
                          {entry.start_mileage.toFixed(1)} - {entry.end_mileage.toFixed(1)} miles ({entry.miles_driven.toFixed(1)} driven)
                        </span>
                      </div>
                      {entry.notes && (
                        <CardDescription className="flex items-center text-muted-foreground italic mt-1">
                          <MessageSquareText className="mr-1 h-3 w-3" />
                          Notes: {entry.notes}
                        </CardDescription>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default MileageTracker;