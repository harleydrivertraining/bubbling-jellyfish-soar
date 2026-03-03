"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import CalendarComponent from "@/components/Calendar";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCcw, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddBookingForm from "@/components/AddBookingForm";
import { addMinutes, startOfMonth, endOfMonth, addMonths, subMonths, differenceInMinutes, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Event as BigCalendarEvent } from 'react-big-calendar';
import { useIsMobile } from "@/hooks/use-mobile";
import CalendarLegend from "@/components/CalendarLegend";

interface CustomEventResource {
  student_id: string;
  description?: string;
  status: "scheduled" | "completed" | "cancelled";
  lesson_type: string;
  targets_for_next_session?: string;
  is_paid: boolean;
  is_covered: boolean;
}

const Schedule: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [isAddBookingDialogOpen, setIsAddBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [events, setEvents] = useState<BigCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [currentCalendarView, _setCurrentCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>('week');
  
  const lastFetchedRange = useRef<string>("");

  const isMobile = useIsMobile();

  const handleSetCurrentCalendarView = useCallback((view: 'month' | 'week' | 'day' | 'agenda') => {
    _setCurrentCalendarView(view);
  }, []);

  useEffect(() => {
    if (isMobile !== undefined) {
      handleSetCurrentCalendarView(isMobile ? 'day' : 'week');
    }
  }, [isMobile, handleSetCurrentCalendarView]);

  const fetchBookings = useCallback(async (startDate: Date, endDate: Date, force = false) => {
    if (!user) {
      setIsLoadingEvents(false);
      return;
    }

    const rangeKey = `${startDate.toISOString()}-${endDate.toISOString()}`;
    if (!force && rangeKey === lastFetchedRange.current) return;
    
    lastFetchedRange.current = rangeKey;
    setIsLoadingEvents(true);
    setFetchError(null);
    
    try {
      // 1. Fetch Main Bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, title, description, start_time, end_time, student_id, status, lesson_type, targets_for_next_session, is_paid, students(name)")
        .eq("user_id", user.id)
        .gte("start_time", startDate.toISOString())
        .lte("end_time", endDate.toISOString());

      if (bookingsError) throw bookingsError;

      if (!bookings || bookings.length === 0) {
        setEvents([]);
        setIsLoadingEvents(false);
        return;
      }

      // 2. Fetch Secondary Data (Non-blocking)
      let paidViaCreditIds = new Set<string>();
      let studentBalances: Record<string, number> = {};
      
      try {
        const bookingIds = bookings.map(b => b.id);
        const { data: transactions } = await supabase
          .from("pre_paid_hours_transactions")
          .select("booking_id")
          .in("booking_id", bookingIds);
        
        if (transactions) {
          paidViaCreditIds = new Set(transactions.map(t => t.booking_id));
        }

        const studentIds = Array.from(new Set(bookings.map(b => b.student_id).filter(Boolean)));
        if (studentIds.length > 0) {
          const { data: hours } = await supabase
            .from("pre_paid_hours")
            .select("student_id, remaining_hours")
            .in("student_id", studentIds);
          
          hours?.forEach(h => {
            studentBalances[h.student_id] = (studentBalances[h.student_id] || 0) + h.remaining_hours;
          });
        }
      } catch (secondaryError) {
        console.warn("Failed to fetch secondary schedule data (payments/balances):", secondaryError);
        // We continue anyway so the user can at least see their lessons
      }

      // 3. Process and Validate Bookings
      const sortedBookings = [...bookings]
        .filter(b => {
          const start = parseISO(b.start_time);
          const end = parseISO(b.end_time);
          return isValid(start) && isValid(end);
        })
        .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime());

      const coverageMap: Record<string, boolean> = {};
      
      sortedBookings.forEach(b => {
        const isAlreadyPaid = b.is_paid || paidViaCreditIds.has(b.id);
        if (!b.student_id || isAlreadyPaid || b.status === 'cancelled') {
          coverageMap[b.id] = false;
          return;
        }

        const duration = differenceInMinutes(new Date(b.end_time), new Date(b.start_time)) / 60;
        const balance = studentBalances[b.student_id] || 0;

        if (balance >= duration) {
          coverageMap[b.id] = true;
          studentBalances[b.student_id] -= duration;
        } else {
          coverageMap[b.id] = false;
        }
      });

      const formattedEvents: BigCalendarEvent[] = sortedBookings.map((booking) => ({
        id: booking.id,
        title: booking.students?.name || booking.title,
        start: new Date(booking.start_time),
        end: new Date(booking.end_time),
        resource: {
          student_id: booking.student_id,
          description: booking.description,
          status: booking.status,
          lesson_type: booking.lesson_type,
          targets_for_next_session: booking.targets_for_next_session,
          is_paid: booking.is_paid || paidViaCreditIds.has(booking.id),
          is_covered: coverageMap[booking.id] || false
        },
      }));
      
      setEvents(formattedEvents);
    } catch (error: any) {
      console.error("Error fetching schedule data:", error);
      const isNetworkError = error.message?.toLowerCase().includes("failed to fetch");
      const msg = isNetworkError 
        ? "Connection lost. Please check your internet or Supabase project status." 
        : error.message || "An unexpected error occurred.";
      
      setFetchError(msg);
      showError("Failed to load schedule: " + msg);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [user]);

  const handleRetry = useCallback(() => {
    const start = startOfMonth(subMonths(currentCalendarDate, 1));
    const end = endOfMonth(addMonths(currentCalendarDate, 2));
    fetchBookings(start, end, true);
  }, [currentCalendarDate, fetchBookings]);

  useEffect(() => {
    if (!isSessionLoading && user) {
      const start = startOfMonth(subMonths(currentCalendarDate, 1));
      const end = endOfMonth(addMonths(currentCalendarDate, 2));
      fetchBookings(start, end);
    }
  }, [isSessionLoading, user, currentCalendarDate, fetchBookings]);

  const handleMarkAsPaid = async (bookingId: string, studentId: string, startTime: string, endTime: string) => {
    if (!user || !studentId) return;
    const duration = differenceInMinutes(new Date(endTime), new Date(startTime)) / 60;

    try {
      const { data: packages, error: pkgError } = await supabase
        .from("pre_paid_hours")
        .select("*")
        .eq("student_id", studentId)
        .gt("remaining_hours", 0)
        .order("purchase_date", { ascending: true });

      if (pkgError) throw pkgError;

      if (packages && packages.length > 0) {
        const pkg = packages[0];
        if (pkg.remaining_hours >= duration) {
          await supabase.from("pre_paid_hours").update({ remaining_hours: pkg.remaining_hours - duration }).eq("id", pkg.id);
          await supabase.from("pre_paid_hours_transactions").insert({
            user_id: user.id,
            pre_paid_hours_id: pkg.id,
            booking_id: bookingId,
            hours_deducted: duration
          });
          showSuccess(`Lesson marked as paid using ${duration.toFixed(1)}h from credit.`);
        } else {
          await supabase.from("bookings").update({ is_paid: true }).eq("id", bookingId);
          showSuccess("Lesson marked as paid (Manual).");
        }
      } else {
        await supabase.from("bookings").update({ is_paid: true }).eq("id", bookingId);
        showSuccess("Lesson marked as paid (Manual).");
      }
      handleRetry();
    } catch (error: any) {
      console.error("Error marking as paid:", error);
      showError("Failed to process payment: " + error.message);
    }
  };

  const handleOpenAddBookingDialog = useCallback((start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setIsAddBookingDialogOpen(true);
  }, []);

  const handleBookingAdded = useCallback(() => {
    handleRetry();
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
  }, [handleRetry]);

  const handleCloseAddBookingDialog = useCallback(() => {
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
  }, []);

  const handleMakeNewBookingClick = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0);
    const defaultEndTime = addMinutes(defaultStartTime, 60);
    handleOpenAddBookingDialog(defaultStartTime, defaultEndTime);
  };

  const handleCalendarEventsRefetch = useCallback((startDate: Date, endDate: Date) => {
    fetchBookings(startDate, endDate);
  }, [fetchBookings]);

  if (isSessionLoading) {
    return (
      <div className="flex flex-col space-y-6 h-full items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium">Loading schedule...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col space-y-6 h-full items-center justify-center p-6 text-center">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Unable to load schedule</h2>
        <p className="text-muted-foreground max-w-md">{fetchError}</p>
        <Button onClick={handleRetry} className="mt-4 font-bold">
          <RefreshCcw className="mr-2 h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Schedule</h1>
        <Button onClick={handleMakeNewBookingClick}>
          <PlusCircle className="mr-2 h-4 w-4" /> Make New Booking
        </Button>
      </div>
      
      {isLoadingEvents && (
        <div className="absolute inset-0 z-50 bg-background/50 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-card p-4 rounded-lg shadow-lg border flex items-center gap-3">
            <RefreshCcw className="h-5 w-5 animate-spin text-primary" />
            <span className="font-bold">Updating schedule...</span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-[600px]">
        <CalendarComponent
          events={events}
          onEventsRefetch={handleCalendarEventsRefetch}
          onSelectSlot={handleOpenAddBookingDialog}
          currentDate={currentCalendarDate}
          setCurrentDate={setCurrentCalendarDate}
          currentView={currentCalendarView}
          setCurrentView={handleSetCurrentCalendarView}
          onMarkAsPaid={handleMarkAsPaid}
        />
      </div>

      <CalendarLegend />

      <Dialog open={isAddBookingDialogOpen} onOpenChange={handleCloseAddBookingDialog}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Booking</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <AddBookingForm
              initialStartTime={selectedSlot.start}
              initialEndTime={selectedSlot.end}
              onBookingAdded={handleBookingAdded}
              onClose={handleCloseAddBookingDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;