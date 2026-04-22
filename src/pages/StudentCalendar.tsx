"use client";

import React, { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Sparkles, 
  CalendarDays, 
  Clock, 
  Info, 
  ClipboardCheck, 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  format, 
  addHours, 
  addWeeks,
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  differenceInMinutes,
  setHours,
  setMinutes,
  startOfDay,
  getDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isValid
} from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  lesson_type: string;
}

const StudentCalendar: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const queryClient = useQueryClient();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [filterDuration, setFilterDuration] = useState<number>(60);

  // 1. Fetch Student Data
  const { data: studentData, isLoading: isLoadingStudent, isError: isStudentError } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("auth_user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // 2. Fetch Instructor Data
  const { data: instructor, isLoading: isLoadingInstructor } = useQuery({
    queryKey: ['instructor-profile', studentData?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentData!.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!studentData?.user_id,
  });

  // 3. Fetch Bookings for the range
  const { data: bookingsData = [], isLoading: isLoadingBookings, isFetching: isFetchingBookings } = useQuery({
    queryKey: ['calendar-bookings', studentData?.user_id, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const rangeStart = startOfMonth(subMonths(currentMonth, 1)).toISOString();
      const rangeEnd = endOfMonth(addMonths(currentMonth, 1)).toISOString();

      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status, lesson_type")
        .eq("user_id", studentData!.user_id)
        .gte("start_time", rangeStart)
        .lte("end_time", rangeEnd);

      if (error) throw error;
      return data || [];
    },
    enabled: !!studentData?.user_id,
  });

  const existingBookings = useMemo(() => 
    bookingsData.filter(b => b.status !== 'available' && b.status !== 'cancelled'),
  [bookingsData]);

  const manualAvailableSlots = useMemo(() => 
    bookingsData.filter(b => b.status === 'available'),
  [bookingsData]);

  const calculatePrice = useCallback((durationMins: number) => {
    if (!instructor) return 0;
    const hours = durationMins / 60;
    if (hours === 1 && instructor.rate_1h) return instructor.rate_1h;
    if (hours === 1.5 && instructor.rate_1_5h) return instructor.rate_1_5h;
    if (hours === 2 && instructor.rate_2h) return instructor.rate_2h;
    return hours * (instructor.hourly_rate || 0);
  }, [instructor]);

  // OPTIMIZED SLOT GENERATION
  const generatedSlots = useMemo(() => {
    if (!instructor || !studentData) return [];
    
    const mode = instructor.booking_mode || "gaps";
    const now = new Date();
    const noticeHours = instructor.min_booking_notice_hours ?? 48;
    const advanceWeeks = instructor.max_booking_advance_weeks ?? 12;
    
    const minStartTimeMs = addHours(now, noticeHours).getTime();
    const maxStartTimeMs = addWeeks(now, advanceWeeks).getTime();
    
    const bufferMs = (instructor.booking_buffer_mins || 0) * 60000;
    const durationMs = filterDuration * 60000;
    // Safety check: interval must be at least 15 mins to prevent infinite loops
    const intervalMs = Math.max(15, instructor.booking_interval_mins || 30) * 60000;

    // Group busy intervals by date string for O(1) lookup per day
    const busyByDay: Record<string, {start: number, end: number}[]> = {};
    existingBookings.forEach(b => {
      if (!b.start_time || !b.end_time) return;
      const dateKey = b.start_time.split('T')[0];
      if (!busyByDay[dateKey]) busyByDay[dateKey] = [];
      busyByDay[dateKey].push({
        start: parseISO(b.start_time).getTime() - bufferMs,
        end: parseISO(b.end_time).getTime() + bufferMs
      });
    });

    const slots: any[] = [];

    if (mode === "gaps") {
      manualAvailableSlots.forEach(gap => {
        if (!gap.start_time || !gap.end_time) return;
        const gapStartMs = parseISO(gap.start_time).getTime();
        const gapEndMs = parseISO(gap.end_time).getTime();
        const dateKey = gap.start_time.split('T')[0];
        const dayBusy = busyByDay[dateKey] || [];

        let currentPointerMs = gapStartMs;
        // Safety limit to prevent runaway loops
        let iterations = 0;
        while (currentPointerMs + durationMs <= gapEndMs && iterations < 100) {
          iterations++;
          const endPointerMs = currentPointerMs + durationMs;
          const isClashing = dayBusy.some(busy => currentPointerMs < busy.end && endPointerMs > busy.start);

          if (currentPointerMs >= minStartTimeMs && currentPointerMs <= maxStartTimeMs && !isClashing) {
            slots.push({
              id: `gap-${gap.id}-${currentPointerMs}`,
              start_time: new Date(currentPointerMs).toISOString(),
              end_time: new Date(endPointerMs).toISOString(),
              isGenerated: true
            });
          }
          currentPointerMs += intervalMs;
        }
      });
    } else {
      const schedule = instructor.working_hours || {};
      const startRange = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
      const endRange = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
      const daysInRange = eachDayOfInterval({ start: startRange, end: endRange });

      const parseTime = (time: string | number | undefined, defaultTime: string) => {
        const t = time ?? defaultTime;
        if (typeof t === 'number') return [t, 0];
        const parts = t.split(':').map(Number);
        return parts.length === 2 ? parts : [9, 0];
      };

      daysInRange.forEach(day => {
        const dayOfWeek = getDay(day).toString();
        const dayConfig = schedule[dayOfWeek];
        if (!dayConfig || !dayConfig.active) return;

        const dateKey = format(day, 'yyyy-MM-dd');
        const dayBusy = busyByDay[dateKey] || [];

        const [startH, startM] = parseTime(dayConfig.start, "09:00");
        const [endH, endM] = parseTime(dayConfig.end, "17:00");

        const dayStartMs = setMinutes(setHours(startOfDay(day), startH), startM).getTime();
        const dayEndMs = setMinutes(setHours(startOfDay(day), endH), endM).getTime();

        let currentPointerMs = dayStartMs;
        let iterations = 0;
        while (currentPointerMs + durationMs <= dayEndMs && iterations < 100) {
          iterations++;
          const endPointerMs = currentPointerMs + durationMs;
          const isClashing = dayBusy.some(busy => currentPointerMs < busy.end && endPointerMs > busy.start);

          if (currentPointerMs >= minStartTimeMs && currentPointerMs <= maxStartTimeMs && !isClashing) {
            slots.push({
              id: `gen-${currentPointerMs}`,
              start_time: new Date(currentPointerMs).toISOString(),
              end_time: new Date(endPointerMs).toISOString(),
              isGenerated: true
            });
          }
          currentPointerMs += intervalMs;
        }
      });
    }

    return slots;
  }, [instructor, studentData, existingBookings, manualAvailableSlots, filterDuration, currentMonth]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const slotsForSelectedDate = useMemo(() => {
    return generatedSlots.filter(slot => isSameDay(parseISO(slot.start_time), selectedDate));
  }, [generatedSlots, selectedDate]);

  const hasSlots = (date: Date) => {
    return generatedSlots.some(slot => isSameDay(parseISO(slot.start_time), date));
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !studentData || !instructor) return;

    setIsBooking(true);
    try {
      const requireApproval = instructor.require_booking_approval ?? false;
      const newStatus = requireApproval ? "pending_approval" : "scheduled";
      const displayTitle = requireApproval 
        ? `${studentData.name} - Pending Approval` 
        : `${studentData.name} - Driving lesson`;

      const { error } = await supabase
        .from("bookings")
        .insert({
          user_id: studentData.user_id,
          student_id: studentData.id,
          status: newStatus,
          title: displayTitle,
          lesson_type: "Driving lesson",
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time
        });

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: studentData.user_id,
        title: requireApproval ? "New Booking Request!" : "New Lesson Booked!",
        message: `${studentData.name} has ${requireApproval ? 'requested' : 'booked'} the slot on ${format(parseISO(selectedSlot.start_time), "PPP p")}.`,
        type: "booking_claimed"
      });

      showSuccess(requireApproval ? "Request sent! Waiting for instructor approval." : "Lesson booked successfully!");
      setSelectedSlot(null);
      queryClient.invalidateQueries({ queryKey: ['calendar-bookings'] });
    } catch (error: any) {
      showError("Failed to book lesson: " + error.message);
    } finally {
      setIsBooking(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-bookings'] });
  };

  if (isSessionLoading || isLoadingStudent || (studentData && isLoadingInstructor)) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (isStudentError || !studentData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Profile Not Found</h2>
        <p className="text-muted-foreground max-w-xs">We couldn't find your student record. Please contact your instructor.</p>
        <Button asChild variant="outline"><Link to="/">Return Home</Link></Button>
      </div>
    );
  }

  const showPrices = instructor?.show_prices_on_booking ?? true;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="-ml-2">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
          </Button>
          <h1 className="text-3xl font-black tracking-tight">Book a Lesson</h1>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh} 
          disabled={isFetchingBookings}
          className="h-10 w-10"
        >
          <RefreshCw className={cn("h-5 w-5", isFetchingBookings && "animate-spin")} />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Select Lesson Length</span>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          {[60, 90, 120].map((mins) => (
            <button
              key={mins}
              onClick={() => setFilterDuration(mins)}
              className={cn(
                "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                filterDuration === mins 
                  ? "border-primary bg-primary/5 shadow-sm" 
                  : "border-muted bg-card hover:border-muted-foreground/30"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-tight opacity-70">
                {mins === 60 ? "1 Hour" : mins === 90 ? "1.5 Hours" : "2 Hours"}
              </span>
              {showPrices && (
                <span className="text-xl font-black text-primary">
                  £{calculatePrice(mins).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr] items-start">
        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg sm:text-xl font-bold">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-7 mb-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div key={i} className="text-center text-[10px] font-black text-muted-foreground uppercase py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {days.map((day, i) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const available = hasSlots(day);
                
                return (
                  <div key={i} className="flex justify-center items-center aspect-square">
                    <button
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all relative",
                        !isCurrentMonth && "text-muted-foreground/30",
                        isCurrentMonth && "text-foreground",
                        isSelected && "bg-primary text-primary-foreground scale-110 shadow-lg",
                        (available && !isSelected) && "border-2 border-blue-500 text-blue-600 bg-blue-50/50"
                      )}
                    >
                      {format(day, "d")}
                      {(available && !isSelected) && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-500" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-black text-xl flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              {isSameDay(selectedDate, new Date()) ? "Today" : format(selectedDate, "EEE, do MMM")}
            </h3>
            <Badge variant="secondary" className="font-bold px-3 py-1">
              {slotsForSelectedDate.length} Available
            </Badge>
          </div>

          <ScrollArea className="h-[500px] pr-4">
            {isLoadingBookings ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : slotsForSelectedDate.length === 0 ? (
              <Card className="border-dashed bg-muted/20 h-full flex items-center justify-center">
                <CardContent className="p-12 text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-tight">No slots available</p>
                    <p className="text-xs text-muted-foreground">Try another date highlighted in blue on the calendar.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {slotsForSelectedDate.map((slot) => {
                  const start = parseISO(slot.start_time);
                  const duration = differenceInMinutes(parseISO(slot.end_time), start) / 60;

                  return (
                    <Card key={slot.id} className="overflow-hidden border-l-4 border-l-blue-500 hover:shadow-md transition-all group">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-xl">{format(start, "p")}</p>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase h-5 bg-blue-50/50">
                              {duration.toFixed(1)}h Lesson
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Ends at {format(parseISO(slot.end_time), "p")}
                          </p>
                        </div>

                        <Button 
                          size="sm" 
                          className={cn(
                            "font-bold h-10 px-6 transition-all", 
                            instructor?.require_booking_approval 
                              ? "bg-orange-600 hover:bg-orange-700" 
                              : "bg-blue-600 hover:bg-blue-700"
                          )}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {instructor?.require_booking_approval ? "Request" : "Book"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              {instructor?.require_booking_approval ? <ClipboardCheck className="h-6 w-6 text-orange-600" /> : <Sparkles className="h-6 w-6 text-blue-600" />}
              {instructor?.require_booking_approval ? "Request Booking" : "Confirm Booking"}
            </DialogTitle>
            <DialogDescription className="text-base font-medium">
              {instructor?.require_booking_approval 
                ? "This slot requires instructor approval. Send a request?" 
                : "Would you like to book this lesson slot?"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSlot && (
            <div className="py-6 space-y-4">
              <div className="p-5 bg-muted rounded-2xl space-y-3 border shadow-inner">
                <div className="flex items-center gap-3 text-base font-bold">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {format(parseISO(selectedSlot.start_time), "EEEE, MMMM do")}
                </div>
                <div className="flex items-center gap-3 text-base font-bold">
                  <Clock className="h-5 w-5 text-primary" />
                  {format(parseISO(selectedSlot.start_time), "p")} — {format(parseISO(selectedSlot.end_time), "p")}
                </div>
              </div>
              
              <div className="flex items-start gap-3 text-xs text-muted-foreground bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <Info className="h-5 w-5 text-blue-500 shrink-0" />
                <p className="leading-relaxed">
                  {instructor?.require_booking_approval 
                    ? "Your instructor will be notified and can approve or decline your request. You'll see the status on your dashboard." 
                    : "Once confirmed, this lesson will be added to your schedule immediately."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setSelectedSlot(null)} disabled={isBooking} className="font-bold h-12">Cancel</Button>
            <Button 
              onClick={handleConfirmBooking} 
              disabled={isBooking} 
              className={cn(
                "font-black h-12 flex-1 sm:flex-none text-lg", 
                instructor?.require_booking_approval ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isBooking ? <Loader2 className="h-5 w-5 animate-spin" /> : instructor?.require_booking_approval ? "Send Request" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentCalendar;