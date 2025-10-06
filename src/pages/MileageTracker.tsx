"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Car, CalendarDays, Gauge, MessageSquareText, ChevronDown, Pencil } from "lucide-react"; // Added Pencil icon
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { enUS } from 'date-fns/locale';
import AddMileageEntryForm from "@/components/AddMileageEntryForm";
import AddCarForm from "@/components/AddCarForm";
import EditCarForm from "@/components/EditCarForm"; // New import
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label"; // Import Label

interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  acquisition_date: string; // YYYY-MM-DD
  initial_mileage: number;
}

interface MileageEntry {
  id: string;
  car_id: string;
  entry_date: string; // YYYY-MM-DD
  current_mileage: number;
  notes?: string;
  miles_driven?: number; // This will be calculated client-side
}

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalMiles: number;
  entries: MileageEntry[];
}

const MileageTracker: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [allMileageEntries, setAllMileageEntries] = useState<MileageEntry[]>([]);
  const [isLoadingCars, setIsLoadingCars] = useState(true); // Separate loading for cars
  const [isLoadingEntries, setIsLoadingEntries] = useState(false); // Separate loading for entries
  const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false);
  const [isAddCarDialogOpen, setIsAddCarDialogOpen] = useState(false);
  const [isEditCarDialogOpen, setIsEditCarDialogOpen] = useState(false); // New state for edit car dialog
  const [searchTerm, setSearchTerm] = useState("");

  // Effect to fetch cars and set initial selectedCarId
  useEffect(() => {
    const fetchCarsData = async () => {
      if (isSessionLoading) return; // Wait for session to load

      setIsLoadingCars(true);
      if (!user) {
        setCars([]);
        setSelectedCarId(null);
        setIsLoadingCars(false);
        return;
      }

      const { data, error } = await supabase
        .from("cars")
        .select("id, make, model, year, acquisition_date, initial_mileage")
        .eq("user_id", user.id)
        .order("make", { ascending: true });

      if (error) {
        console.error("Error fetching cars:", error);
        showError("Failed to load cars: " + error.message);
        setCars([]);
        setSelectedCarId(null);
      } else {
        setCars(data || []);
        // Only set selectedCarId if it's currently null or the previously selected one no longer exists
        if (!selectedCarId || !data.some(car => car.id === selectedCarId)) {
          setSelectedCarId(data.length > 0 ? data[0].id : null);
        }
      }
      setIsLoadingCars(false);
    };

    fetchCarsData();
  }, [isSessionLoading, user, selectedCarId]); // selectedCarId is a dependency to re-evaluate if the selected car is still valid

  // Effect to fetch mileage entries when selectedCarId changes
  useEffect(() => {
    const fetchMileageEntriesData = async () => {
      if (isSessionLoading || !user || !selectedCarId) {
        setAllMileageEntries([]);
        setIsLoadingEntries(false); // Ensure loading is false if no car selected or no user
        return;
      }

      setIsLoadingEntries(true);
      const { data, error } = await supabase
        .from("car_mileage_entries")
        .select("id, entry_date, current_mileage, notes")
        .eq("user_id", user.id)
        .eq("car_id", selectedCarId)
        .order("entry_date", { ascending: true }); // Order ascending to calculate differences

      if (error) {
        console.error("Error fetching mileage entries:", error);
        showError("Failed to load mileage entries: " + error.message);
        setAllMileageEntries([]);
      } else {
        const carDetails = cars.find(car => car.id === selectedCarId);
        let previousMileage = carDetails ? carDetails.initial_mileage : 0;
        let previousEntryDate: Date | null = carDetails ? parseISO(carDetails.acquisition_date) : null;

        const formattedEntries: MileageEntry[] = (data || []).map(entry => {
          const entryDate = parseISO(entry.entry_date);
          let milesDriven = 0;

          // Calculate miles driven since the last entry or car acquisition
          if (previousEntryDate && entryDate > previousEntryDate) {
            milesDriven = entry.current_mileage - previousMileage;
          } else if (!previousEntryDate && carDetails) {
            // This case handles the very first entry if acquisition_date is not set or earlier
            milesDriven = entry.current_mileage - carDetails.initial_mileage;
          }
          
          previousMileage = entry.current_mileage;
          previousEntryDate = entryDate;

          return {
            ...entry,
            miles_driven: Math.max(0, milesDriven), // Ensure miles driven is not negative
          };
        });
        setAllMileageEntries(formattedEntries);
      }
      setIsLoadingEntries(false);
    };

    fetchMileageEntriesData();
  }, [isSessionLoading, user, selectedCarId, cars]); // `cars` is a dependency because `carDetails` depends on it.

  const handleEntryAdded = () => {
    // Re-fetch entries for the currently selected car
    // This will trigger the the useEffect for entries due to selectedCarId dependency
    if (selectedCarId) {
      const fetchEntriesForSelectedCar = async () => {
        if (user && selectedCarId) {
          setIsLoadingEntries(true);
          const { data, error } = await supabase
            .from("car_mileage_entries")
            .select("id, entry_date, current_mileage, notes")
            .eq("user_id", user.id)
            .eq("car_id", selectedCarId)
            .order("entry_date", { ascending: true });
          
          if (error) {
            console.error("Error fetching mileage entries after add:", error);
            showError("Failed to refresh mileage entries: " + error.message);
            setAllMileageEntries([]);
          } else {
            const carDetails = cars.find(car => car.id === selectedCarId);
            let previousMileage = carDetails ? carDetails.initial_mileage : 0;
            let previousEntryDate: Date | null = carDetails ? parseISO(carDetails.acquisition_date) : null;

            const formattedEntries: MileageEntry[] = (data || []).map(entry => {
              const entryDate = parseISO(entry.entry_date);
              let milesDriven = 0;

              if (previousEntryDate && entryDate > previousEntryDate) {
                milesDriven = entry.current_mileage - previousMileage;
              } else if (!previousEntryDate && carDetails) {
                milesDriven = entry.current_mileage - carDetails.initial_mileage;
              }
              
              previousMileage = entry.current_mileage;
              previousEntryDate = entryDate;

              return {
                ...entry,
                miles_driven: Math.max(0, milesDriven),
              };
            });
            setAllMileageEntries(formattedEntries);
          }
          setIsLoadingEntries(false);
        }
      };
      fetchEntriesForSelectedCar();
    }
    setIsAddEntryDialogOpen(false);
  };

  const handleCloseAddEntryDialog = () => {
    setIsAddEntryDialogOpen(false);
  };

  const handleCarAdded = () => {
    // Re-fetch cars to update the dropdown and potentially set a new selectedCarId
    // This will trigger the first useEffect due to user dependency
    const fetchCarsAfterAdd = async () => {
      if (!user) return;
      setIsLoadingCars(true);
      const { data, error } = await supabase
        .from("cars")
        .select("id, make, model, year, acquisition_date, initial_mileage")
        .eq("user_id", user.id)
        .order("make", { ascending: true });

      if (error) {
        console.error("Error fetching cars after add:", error);
        showError("Failed to refresh cars: " + error.message);
        setCars([]);
      } else {
        setCars(data || []);
        // If no car was selected before, or the new car is the first, select it
        if (!selectedCarId && data.length > 0) {
          setSelectedCarId(data[0].id);
        }
      }
      setIsLoadingCars(false);
    };
    fetchCarsAfterAdd();
    setIsAddCarDialogOpen(false);
  };

  const handleCloseAddCarDialog = () => {
    setIsAddCarDialogOpen(false);
  };

  const handleCarUpdated = () => {
    // Re-fetch cars to update the dropdown and potentially set a new selectedCarId
    // This will trigger the first useEffect due to user dependency
    const fetchCarsAfterUpdate = async () => {
      if (!user) return;
      setIsLoadingCars(true);
      const { data, error } = await supabase
        .from("cars")
        .select("id, make, model, year, acquisition_date, initial_mileage")
        .eq("user_id", user.id)
        .order("make", { ascending: true });

      if (error) {
        console.error("Error fetching cars after update:", error);
        showError("Failed to refresh cars: " + error.message);
        setCars([]);
      } else {
        setCars(data || []);
        // Ensure the currently selected car is still valid, or select the first one
        if (!selectedCarId || !data.some(car => car.id === selectedCarId)) {
          setSelectedCarId(data.length > 0 ? data[0].id : null);
        }
      }
      setIsLoadingCars(false);
    };
    fetchCarsAfterUpdate();
    setIsEditCarDialogOpen(false);
  };

  const handleCarDeleted = () => {
    // Re-fetch cars to update the dropdown and select a new car if the current one was deleted
    const fetchCarsAfterDelete = async () => {
      if (!user) return;
      setIsLoadingCars(true);
      const { data, error } = await supabase
        .from("cars")
        .select("id, make, model, year, acquisition_date, initial_mileage")
        .eq("user_id", user.id)
        .order("make", { ascending: true });

      if (error) {
        console.error("Error fetching cars after delete:", error);
        showError("Failed to refresh cars: " + error.message);
        setCars([]);
      } else {
        setCars(data || []);
        // If the deleted car was selected, select the first available car, or null if none
        setSelectedCarId(data.length > 0 ? data[0].id : null);
      }
      setIsLoadingCars(false);
    };
    fetchCarsAfterDelete();
    setIsEditCarDialogOpen(false);
  };

  const handleCloseEditCarDialog = () => {
    setIsEditCarDialogOpen(false);
  };

  const currentCar = useMemo(() => cars.find(car => car.id === selectedCarId), [cars, selectedCarId]);

  const { groupedAndFilteredEntries, totalMilesThisWeek, totalMilesThisMonth, totalMilesThisYear, totalMilesSinceAcquisition } = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1, locale: enUS });
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1, locale: enUS });
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const currentYearStart = startOfYear(now);
    const currentYearEnd = endOfYear(now);

    let totalMilesThisWeek = 0;
    let totalMilesThisMonth = 0;
    let totalMilesThisYear = 0;
    let totalMilesSinceAcquisition = 0;

    const grouped: { [key: string]: WeeklySummary } = {};

    const filtered = allMileageEntries.filter(entry => {
      const entryDate = parseISO(entry.entry_date);
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      return (
        entry.notes?.toLowerCase().includes(lowerCaseSearchTerm) ||
        entry.current_mileage.toString().includes(lowerCaseSearchTerm) ||
        format(entryDate, "PPP").toLowerCase().includes(lowerCaseSearchTerm)
      );
    });

    // Sort entries by date descending for display, but ascending for calculation
    const sortedEntriesForDisplay = [...filtered].sort((a, b) => parseISO(b.entry_date).getTime() - parseISO(a.entry_date).getTime());

    sortedEntriesForDisplay.forEach(entry => {
      const entryDate = parseISO(entry.entry_date);
      const milesDriven = entry.miles_driven || 0;

      // Calculate totals
      if (isWithinInterval(entryDate, { start: currentWeekStart, end: currentWeekEnd })) {
        totalMilesThisWeek += milesDriven;
      }
      if (isWithinInterval(entryDate, { start: currentMonthStart, end: currentMonthEnd })) {
        totalMilesThisMonth += milesDriven;
      }
      if (isWithinInterval(entryDate, { start: currentYearStart, end: currentYearEnd })) {
        totalMilesThisYear += milesDriven;
      }
      totalMilesSinceAcquisition += milesDriven; // Sum all calculated miles driven

      // Group for weekly display
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 1, locale: enUS });
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
      grouped[weekKey].totalMiles += milesDriven;
      grouped[weekKey].entries.push(entry);
    });

    // Sort weeks from most recent to oldest
    const sortedWeeks = Object.values(grouped).sort((a, b) => {
      return parseISO(b.weekStart).getTime() - parseISO(a.weekStart).getTime();
    });

    return {
      groupedAndFilteredEntries: sortedWeeks,
      totalMilesThisWeek,
      totalMilesThisMonth,
      totalMilesThisYear,
      totalMilesSinceAcquisition,
    };
  }, [allMileageEntries, searchTerm]);

  const isLoadingPage = isSessionLoading || isLoadingCars || isLoadingEntries;

  if (isLoadingPage) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
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
        <div className="flex gap-2">
          <Dialog open={isAddCarDialogOpen} onOpenChange={setIsAddCarDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Car className="mr-2 h-4 w-4" /> Add New Car
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Car</DialogTitle>
              </DialogHeader>
              <AddCarForm onCarAdded={handleCarAdded} onClose={handleCloseAddCarDialog} />
            </DialogContent>
          </Dialog>

          <Dialog open={isAddEntryDialogOpen} onOpenChange={setIsAddEntryDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={cars.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Mileage Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Mileage Entry</DialogTitle>
              </DialogHeader>
              <AddMileageEntryForm
                onEntryAdded={handleEntryAdded}
                onClose={handleCloseAddEntryDialog}
                initialCarId={selectedCarId || undefined}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {cars.length === 0 ? (
        <p className="text-muted-foreground">No cars added yet. Please add a car to start tracking mileage.</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Label htmlFor="car-select">Select Car:</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-between">
                  {currentCar ? `${currentCar.make} ${currentCar.model} (${currentCar.year})` : "Select a car"}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]">
                <DropdownMenuLabel>Your Cars</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {cars.map((car) => (
                  <DropdownMenuItem key={car.id} onSelect={() => setSelectedCarId(car.id)}>
                    {car.make} {car.model} ({car.year})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {currentCar && (
              <Dialog open={isEditCarDialogOpen} onOpenChange={setIsEditCarDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" /> Edit Car
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Car Details</DialogTitle>
                  </DialogHeader>
                  <EditCarForm
                    carId={currentCar.id}
                    onCarUpdated={handleCarUpdated}
                    onCarDeleted={handleCarDeleted}
                    onClose={handleCloseEditCarDialog}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>

          {currentCar ? (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Miles This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {totalMilesThisWeek.toFixed(1)}
                      <span className="text-xl text-muted-foreground ml-2">miles</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Miles This Month</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {totalMilesThisMonth.toFixed(1)}
                      <span className="text-xl text-muted-foreground ml-2">miles</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Miles This Year</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {totalMilesThisYear.toFixed(1)}
                      <span className="text-xl text-muted-foreground ml-2">miles</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Total Miles (Since Acquisition)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {totalMilesSinceAcquisition.toFixed(1)}
                      <span className="text-xl text-muted-foreground ml-2">miles</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Input
                placeholder="Search entries by date or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />

              {groupedAndFilteredEntries.length === 0 && allMileageEntries.length > 0 ? (
                <p className="text-muted-foreground col-span-full">No mileage entries match your search criteria for the selected car.</p>
              ) : allMileageEntries.length === 0 ? (
                <p className="text-muted-foreground">No mileage entries recorded yet for this car. Click "Add Mileage Entry" to get started!</p>
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
                                  {entry.current_mileage.toFixed(1)} miles ({(entry.miles_driven || 0).toFixed(1)} driven)
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
            </>
          ) : (
            <p className="text-muted-foreground">Please select a car to view its mileage data.</p>
          )}
        </>
      )}
    </div>
  );
};

export default MileageTracker;