"use client";

import React, { useState, useCallback, useEffect } from "react";
import CalendarComponent from "@/components/Calendar";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddBookingForm from "@/components/AddBookingForm";
import { addMinutes, startOfWeek } from "date-fns"; // Import startOfWeek
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
  const { user, isLoading: isSessionLoading } = useSession();
  const [isAddBookingDialogOpen, setIsAddBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [events, setEvents] = useState<BigCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // NEW: Lift state up from CalendarComponent
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [currentCalendarView, setCurrentCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>('week'); // Default to 'week'

  const isMobile = useIsMobile(); // Determine mobile status

  // Effect to set the initial view based on isMobile once it's determined
  useEffect(() => {
    if (isMobile !== undefined) { // Only set once when isMobile is determined
      setCurrentCalendarView(isMobile ? 'day' : 'week');
    }
  }, [isMobile]);

  const fetchBookings = useCallback(async () => {
    if (!user) {
      setIsLoadingEvents(false);
      return;
    }

    setIsLoadingEvents(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, student_id, status, lesson_type, targets_for_next_session, students(name)")
      .eq("user_id", user.id);

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

  useEffect(() => {
    if (!isSessionLoading) {
      fetchBookings();
    }
  }, [isSessionLoading, fetchBookings]);

  const handleOpenAddBookingDialog = useCallback((start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setIsAddBookingDialogOpen(true);
  }, []);

  const handleBookingAdded = useCallback(() => {
    fetchBookings(); // Refresh the list after a new booking is added
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
  }, [fetchBookings]);

  const handleCloseAddBookingDialog = useCallback(() => {
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
  }, []);

  const handleMakeNewBookingClick = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    // Round up to the next 15-minute interval
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0);
    const defaultEndTime = addMinutes(defaultStartTime, 60); // Default to 1 hour lesson

    handleOpenAddBookingDialog(defaultStartTime, defaultEndTime);
  };

  if (isSessionLoading || isLoadingEvents) {
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
          onEventsRefetch={fetchBookings}
          onSelectSlot={handleOpenAddBookingDialog}
          currentDate={currentCalendarDate}
          setCurrentDate={setCurrentCalendarDate}
          currentView={currentCalendarView}
          setCurrentView={setCurrentCalendarView}
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