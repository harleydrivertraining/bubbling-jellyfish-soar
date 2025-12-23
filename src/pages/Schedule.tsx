"use client";

import React, { useState, useCallback, useEffect } from "react";
import CalendarComponent from "@/components/Calendar";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddBookingForm from "@/components/AddBookingForm";
import { addMinutes, startOfWeek, parseISO, startOfMonth, endOfMonth, addMonths } from "date-fns"; // Import date-fns
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Event as BigCalendarEvent } from 'react-big-calendar';
import { useIsMobile } from "@/hooks/use-mobile"; // Import useIsMobile hook

interface CustomEventResource {
  student_id: string;
  description?: string;
  status: "scheduled" | "completed" | "cancelled";
  lesson_type: string;
  targets_for_next_session?: string;
}

const Schedule: React.FC = () => {
  const { user, isLoading: isSessionLoading, initialBookings, isLoadingInitialBookings } = useSession(); // Consume initialBookings
  const [isAddBookingDialogOpen, setIsAddBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [events, setEvents] = useState<BigCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [currentCalendarView, _setCurrentCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>('week');

  const isMobile = useIsMobile();

  // Create a stable setter for currentCalendarView
  const handleSetCurrentCalendarView = useCallback((view: 'month' | 'week' | 'day' | 'agenda') => {
    _setCurrentCalendarView(view);
  }, []);

  useEffect(() => {
    if (isMobile !== undefined) {
      handleSetCurrentCalendarView(isMobile ? 'day' : 'week');
    }
  }, [isMobile, handleSetCurrentCalendarView]);

  // Modified fetchBookings to fetch within a dynamic range
  const fetchBookings = useCallback(async (startDate: Date, endDate: Date) => {
    if (!user) {
      setIsLoadingEvents(false);
      return;
    }

    setIsLoadingEvents(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, student_id, status, lesson_type, targets_for_next_session, students(name)")
      .eq("user_id", user.id)
      .gte("start_time", startDate.toISOString())
      .lte("end_time", endDate.toISOString());

    if (error) {
      console.error("Error fetching bookings:", error);
      showError("Failed to load bookings: " + error.message);
      setEvents([]);
    } else {
      const formattedEvents: BigCalendarEvent[] = data.map((booking) => ({
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
        },
      }));
      setEvents(formattedEvents);
    }
    setIsLoadingEvents(false);
  }, [user]);

  // Effect to handle initial bookings and subsequent fetches
  useEffect(() => {
    if (!isSessionLoading && user) {
      if (initialBookings && !isLoadingInitialBookings) {
        // Use initial bookings if available
        const formattedInitialEvents: BigCalendarEvent[] = initialBookings.map((booking) => ({
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
          },
        }));
        setEvents(formattedInitialEvents);
        setIsLoadingEvents(false);
      } else if (!isLoadingInitialBookings) {
        // If no initial bookings (e.g., first login, or error), fetch for current view
        const start = startOfMonth(currentCalendarDate);
        const end = endOfMonth(addMonths(currentCalendarDate, 2)); // Fetch current + next 2 months
        fetchBookings(start, end);
      }
    }
  }, [isSessionLoading, user, initialBookings, isLoadingInitialBookings, currentCalendarDate, fetchBookings]);


  const handleOpenAddBookingDialog = useCallback((start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setIsAddBookingDialogOpen(true);
  }, []);

  const handleBookingAdded = useCallback(() => {
    // When a booking is added, refetch for the current view range
    const start = startOfMonth(currentCalendarDate);
    const end = endOfMonth(addMonths(currentCalendarDate, 2));
    fetchBookings(start, end);
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
  }, [fetchBookings, currentCalendarDate]);

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

  // Function to refetch events for the calendar component
  const handleCalendarEventsRefetch = useCallback((startDate: Date, endDate: Date) => {
    fetchBookings(startDate, endDate);
  }, [fetchBookings]);


  if (isSessionLoading || isLoadingEvents || isLoadingInitialBookings) { // Include isLoadingInitialBookings
    return (
      <div className="flex flex-col space-y-6 h-full items-center justify-center">
        <p>Loading schedule...</p>
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
      <div className="flex-1 min-h-[600px]">
        <CalendarComponent
          events={events}
          onEventsRefetch={handleCalendarEventsRefetch} // Pass the new refetch handler
          onSelectSlot={handleOpenAddBookingDialog}
          currentDate={currentCalendarDate}
          setCurrentDate={setCurrentCalendarDate}
          currentView={currentCalendarView}
          setCurrentView={handleSetCurrentCalendarView}
        />
      </div>

      <Dialog open={isAddBookingDialogOpen} onOpenChange={handleCloseAddBookingDialog}>
        <DialogContent className="sm:max-w-[425px]">
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