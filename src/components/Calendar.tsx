"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import endOfWeek from 'date-fns/endOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import Toolbar from 'react-big-calendar/lib/Toolbar';
import { isWithinInterval, setHours, getHours, getMinutes, startOfDay, endOfDay, startOfMonth, endOfMonth, addMonths } from 'date-fns'; // Added startOfMonth, endOfMonth, addMonths
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditBookingForm from "@/components/EditBookingForm";
import CalendarEventWrapper from "@/components/CalendarEventWrapper";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
// Removed useIsMobile import as it's now handled in the parent Schedule.tsx

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1, locale: locales['en-US'] }), // Set weekStartsOn to 1 for Monday
  getDay,
  locales,
});

const DEFAULT_MIN_HOUR = 9;
const DEFAULT_MAX_HOUR = 18; // 6 PM

const calculateDynamicTimeRange = (currentDate: Date, events: BigCalendarEvent[], currentView: string) => {
  // Min/max only apply to week and day views
  if (currentView !== 'month' && currentView !== 'day') {
    // Ensure minutes/seconds are zeroed out for default range
    return {
      min: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MIN_HOUR, 0, 0, 0),
      max: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MAX_HOUR, 0, 0, 0),
    };
  }

  let minHour = DEFAULT_MIN_HOUR;
  let maxHour = DEFAULT_MAX_HOUR;

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1, locale: locales['en-US'] }); // Use Monday as start of week
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1, locale: locales['en-US'] }); // Use Monday as start of week

  const eventsInCurrentWeek = events.filter(event => {
    const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
    const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);

    return (
      isWithinInterval(eventStart, { start: weekStart, end: weekEnd }) ||
      isWithinInterval(eventEnd, { start: weekStart, end: weekEnd }) ||
      (eventStart < weekStart && eventEnd > weekEnd) // Events spanning across the entire week
    );
  });

  if (eventsInCurrentWeek.length > 0) {
    let earliestEventTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59, 999); // Initialize to a very late time
    let latestEventTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0); // Initialize to a very early time

    eventsInCurrentWeek.forEach(event => {
      const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
      const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);

      if (eventStart < earliestEventTime) earliestEventTime = eventStart;
      if (eventEnd > latestEventTime) latestEventTime = eventEnd;
    });

    const earliestEventHour = getHours(earliestEventTime);
    const latestEventHour = getHours(latestEventTime);
    const latestEventMinute = getMinutes(latestEventTime);

    if (earliestEventHour < DEFAULT_MIN_HOUR) {
      minHour = earliestEventHour;
    }
    // Adjust maxHour if the latest event ends after the default max hour,
    // or if it ends exactly at the default max hour but has minutes.
    if (latestEventHour > DEFAULT_MAX_HOUR || (latestEventHour === DEFAULT_MAX_HOUR && latestEventMinute > 0)) {
      maxHour = latestEventHour + (latestEventMinute > 0 ? 1 : 0); // Round up to the next hour if there are minutes
    }
  }

  // Explicitly create new Date objects with minutes, seconds, milliseconds set to 0
  const minDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), minHour, 0, 0, 0);
  const maxDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), maxHour, 0, 0, 0);

  return { min: minDate, max: maxDate };
};

interface CalendarComponentProps {
  events: BigCalendarEvent[];
  onEventsRefetch: (startDate: Date, endDate: Date) => void; // Modified to accept date range
  onSelectSlot: (start: Date, end: Date) => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  currentView: 'month' | 'week' | 'day' | 'agenda';
  setCurrentView: (view: 'month' | 'week' | 'day' | 'agenda') => void;
}

const CalendarComponent: React.FC<CalendarComponentProps> = ({
  events,
  onEventsRefetch,
  onSelectSlot,
  currentDate,
  setCurrentDate,
  currentView,
  setCurrentView,
}) => {
  const { user } = useSession();

  const [minTime, setMinTime] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MIN_HOUR, 0, 0, 0));
  const [maxTime, setMaxTime] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MAX_HOUR, 0, 0, 0));

  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  useEffect(() => {
    const { min, max } = calculateDynamicTimeRange(currentDate, events, currentView);
    setMinTime(min);
    setMaxTime(max);
  }, [events, currentDate, currentView]);

  const handleNavigate = useCallback((newDate: Date, view: string) => {
    setCurrentDate(newDate);

    // Determine the new date range to fetch based on the newDate and currentView
    let fetchStartDate: Date;
    let fetchEndDate: Date;

    switch (view) {
      case 'month':
        fetchStartDate = startOfMonth(newDate);
        fetchEndDate = endOfMonth(newDate);
        break;
      case 'week':
        fetchStartDate = startOfWeek(newDate, { weekStartsOn: 1 });
        fetchEndDate = endOfWeek(newDate, { weekStartsOn: 1 });
        break;
      case 'day':
        fetchStartDate = startOfDay(newDate);
        fetchEndDate = endOfDay(newDate);
        break;
      case 'agenda':
        // For agenda, fetch a wider range, e.g., current month + next 2 months
        fetchStartDate = startOfMonth(newDate);
        fetchEndDate = endOfMonth(addMonths(newDate, 2));
        break;
      default:
        fetchStartDate = startOfMonth(newDate);
        fetchEndDate = endOfMonth(addMonths(newDate, 2));
        break;
    }
    onEventsRefetch(fetchStartDate, fetchEndDate); // Trigger refetch with new range
  }, [setCurrentDate, onEventsRefetch]);

  const handleView = useCallback((newView: string) => {
    setCurrentView(newView as 'month' | 'week' | 'day' | 'agenda');
    // When view changes, also refetch for the current date in the new view's range
    let fetchStartDate: Date;
    let fetchEndDate: Date;

    switch (newView) {
      case 'month':
        fetchStartDate = startOfMonth(currentDate);
        fetchEndDate = endOfMonth(currentDate);
        break;
      case 'week':
        fetchStartDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        fetchEndDate = endOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case 'day':
        fetchStartDate = startOfDay(currentDate);
        fetchEndDate = endOfDay(currentDate);
        break;
      case 'agenda':
        fetchStartDate = startOfMonth(currentDate);
        fetchEndDate = endOfMonth(addMonths(currentDate, 2));
        break;
      default:
        fetchStartDate = startOfMonth(currentDate);
        fetchEndDate = endOfMonth(addMonths(currentDate, 2));
        break;
    }
    onEventsRefetch(fetchStartDate, fetchEndDate);
  }, [setCurrentView, currentDate, onEventsRefetch]);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    onSelectSlot(start, end);
  }, [onSelectSlot]);

  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    setSelectedBookingId(event.id as string);
    setIsEditBookingDialogOpen(true);
  }, []);

  const handleBookingUpdated = () => {
    // When a booking is updated, refetch for the current view range
    const start = startOfMonth(currentDate);
    const end = endOfMonth(addMonths(currentDate, 2));
    onEventsRefetch(start, end);
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleBookingDeleted = () => {
    // When a booking is deleted, refetch for the current view range
    const start = startOfMonth(currentDate);
    const end = endOfMonth(addMonths(currentDate, 2));
    onEventsRefetch(start, end);
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleMarkAllDayBookingsAsCompleted = useCallback(async () => {
    if (!user) {
      showError("You must be logged in to update bookings.");
      return;
    }

    const startOfCurrentDay = startOfDay(currentDate);
    const endOfCurrentDay = endOfDay(currentDate);

    const { data: bookingsToUpdate, error: fetchError } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .gte("start_time", startOfCurrentDay.toISOString())
      .lte("end_time", endOfCurrentDay.toISOString());

    if (fetchError) {
      console.error("Error fetching bookings to mark as completed:", fetchError);
      showError("Failed to fetch bookings: " + fetchError.message);
      return;
    }

    if (!bookingsToUpdate || bookingsToUpdate.length === 0) {
      showError("No scheduled bookings found for this day to mark as completed.");
      return;
    }

    const bookingIdsToUpdate = bookingsToUpdate.map(b => b.id);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .in("id", bookingIdsToUpdate);

    if (updateError) {
      console.error("Error marking all day bookings as completed:", updateError);
      showError("Failed to mark all bookings as completed: " + updateError.message);
    } else {
      showSuccess(`${bookingIdsToUpdate.length} booking(s) marked as completed for ${format(currentDate, "PPP")}!`);
      // After marking as completed, refetch events for the current view range
      const start = startOfMonth(currentDate);
      const end = endOfMonth(addMonths(currentDate, 2));
      onEventsRefetch(start, end);
    }
  }, [user, currentDate, onEventsRefetch]);

  return (
    <div className="h-full flex flex-col bg-card p-4 rounded-lg shadow-sm">
      {currentView === 'day' && (
        <div className="flex justify-end mb-4">
          <Button onClick={handleMarkAllDayBookingsAsCompleted} variant="outline">
            <CheckCircle className="mr-2 h-4 w-4" /> Mark All Day's Bookings as Completed
          </Button>
        </div>
      )}
      <div className="flex-1">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={['month', 'week', 'day', 'agenda']}
          view={currentView}
          onView={handleView}
          components={{
            toolbar: Toolbar,
            event: (props) => (
              <CalendarEventWrapper
                {...props}
                onEventStatusChange={handleBookingUpdated} // Use handleBookingUpdated to trigger refetch
              />
            ),
          }}
          min={minTime}
          max={maxTime}
          onNavigate={handleNavigate}
          date={currentDate}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      <Dialog open={isEditBookingDialogOpen} onOpenChange={setIsEditBookingDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {selectedBookingId && (
            <EditBookingForm
              bookingId={selectedBookingId}
              onBookingUpdated={handleBookingUpdated}
              onBookingDeleted={handleBookingDeleted}
              onClose={() => setIsEditBookingDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarComponent;