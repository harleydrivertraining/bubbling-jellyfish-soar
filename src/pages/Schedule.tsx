"use client";

import React, { useState, useCallback, useEffect } from "react";
import CalendarComponent from "@/components/Calendar";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCcw, ClipboardCheck, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddBookingForm from "@/components/AddBookingForm";
import BookingSettingsForm from "@/components/BookingSettingsForm";
import { addMinutes, startOfMonth, endOfMonth, addMonths, subMonths, differenceInMinutes, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import CalendarLegend from "@/components/CalendarLegend";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const Schedule: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [isAddBookingDialogOpen, setIsAddBookingDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [calendarHours, setCalendarHours] = useState({ start: 9, end: 18 });
  const [pendingCount, setPendingCount] = useState(0);

  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [currentCalendarView, setCurrentCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>('week');
  
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile !== undefined) {
      setCurrentCalendarView(isMobile ? 'day' : 'week');
    }
  }, [isMobile]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("calendar_start_hour, calendar_end_hour")
        .eq("id", user.id)
        .single();
      
      if (data) {
        setCalendarHours({
          start: data.calendar_start_hour ?? 9,
          end: data.calendar_end_hour ?? 18
        });
      }
    };
    fetchSettings();
  }, [user]);

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!user) return;
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "pending_approval");
      
      setPendingCount(count || 0);
    };
    fetchPendingCount();
  }, [user]);

  const processBookings = useCallback(async (bookings: any[]) => {
    if (!user || !bookings.length) return [];

    let paidViaCreditIds = new Set<string>();
    let studentBalances: Record<string, number> = {};
    
    try {
      const bookingIds = bookings.map(b => b.id);
      const { data: transactions } = await supabase
        .from("pre_paid_hours_transactions")
        .select("booking_id")
        .in("booking_id", bookingIds);
      
      if (transactions) paidViaCreditIds = new Set(transactions.map(t => t.booking_id));

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
      console.warn("Secondary data fetch failed:", secondaryError);
    }

    const sortedBookings = [...bookings]
      .filter(b => isValid(parseISO(b.start_time)) && isValid(parseISO(b.end_time)))
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

    return sortedBookings.map((booking) => ({
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
  }, [user]);

  const { data: events = [], isLoading: isLoadingEvents, refetch } = useQuery({
    queryKey: ['schedule-events', user?.id, currentCalendarDate.toISOString().slice(0, 7)],
    queryFn: async () => {
      const start = startOfMonth(subMonths(currentCalendarDate, 1));
      const end = endOfMonth(addMonths(currentCalendarDate, 2));
      
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, title, description, start_time, end_time, student_id, status, lesson_type, targets_for_next_session, is_paid, students(name)")
        .eq("user_id", user!.id)
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString());

      if (bookingsError) throw bookingsError;
      return processBookings(bookings || []);
    },
    enabled: !!user && !isSessionLoading,
  });

  const handleMarkAsPaid = async (bookingId: string) => {
    if (!user) return;
    const { error } = await supabase.from("bookings").update({ is_paid: true }).eq("id", bookingId);
    if (error) showError("Failed to mark as paid.");
    else {
      showSuccess("Lesson marked as paid.");
      refetch();
    }
  };

  const handleOpenAddBookingDialog = useCallback((start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setIsAddBookingDialogOpen(true);
  }, []);

  const handleBookingAdded = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ['schedule-events'] });
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
  }, [queryClient]);

  if (isSessionLoading || (isLoadingEvents && events.length === 0)) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 h-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-bold">Schedule</h1>
          {isLoadingEvents && events.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground animate-pulse uppercase tracking-wider">
              <RefreshCcw className="h-2.5 w-2.5 animate-spin" /> Updating...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsSettingsDialogOpen(true)}
            className="h-9 w-9 sm:h-10 sm:w-10"
            title="Booking Settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => handleOpenAddBookingDialog(new Date(), addMinutes(new Date(), 60))} 
            className="shrink-0 h-9 sm:h-10 px-3 sm:px-4 font-bold"
            size={isMobile ? "sm" : "default"}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> 
            New Booking
          </Button>
        </div>
      </div>
      
      <div className="flex-1 min-h-[600px]">
        <CalendarComponent
          events={events}
          onEventsRefetch={() => refetch()}
          onSelectSlot={handleOpenAddBookingDialog}
          currentDate={currentCalendarDate}
          setCurrentDate={setCurrentCalendarDate}
          currentView={currentCalendarView}
          setCurrentView={setCurrentCalendarView}
          onMarkAsPaid={handleMarkAsPaid}
          defaultStartHour={calendarHours.start}
          defaultEndHour={calendarHours.end}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Button asChild variant="outline" className={cn(
          "w-full h-12 font-black text-lg border-2 transition-all",
          pendingCount > 0 
            ? "bg-orange-50 border-orange-500 text-orange-700 hover:bg-orange-100 animate-pulse" 
            : "bg-muted/30 border-muted text-muted-foreground"
        )}>
          <Link to="/pending-requests">
            <ClipboardCheck className="mr-2 h-5 w-5" />
            View Pending Requests {pendingCount > 0 && `(${pendingCount})`}
          </Link>
        </Button>

        <CalendarLegend />
      </div>

      <Dialog open={isAddBookingDialogOpen} onOpenChange={setIsAddBookingDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Booking</DialogTitle></DialogHeader>
          {selectedSlot && (
            <AddBookingForm
              initialStartTime={selectedSlot.start}
              initialEndTime={selectedSlot.end}
              onBookingAdded={handleBookingAdded}
              onClose={() => setIsAddBookingDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Booking Controls
            </DialogTitle>
          </DialogHeader>
          <BookingSettingsForm onSuccess={() => setIsSettingsDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;