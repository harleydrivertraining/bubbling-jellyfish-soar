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
import { isWithinInterval, setHours, getHours, getMinutes } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditBookingForm from "@/components/EditBookingForm"; // Import the new EditBookingForm
import CalendarEventWrapper from "@/components/CalendarEventWrapper"; // New import

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
  if (currentView !== 'week' && currentView !== 'day') {
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
  onSelectSlot: (start: Date, end: Date) => void;
}

const CalendarComponent: React.FC<CalendarComponentProps> = ({ onSelectSlot }) => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [events, setEvents] = useState<BigCalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('week'); // Default view
  const [minTime, setMinTime] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MIN_HOUR, 0, 0, 0));
  const [maxTime, setMaxTime] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MAX_HOUR, 0, 0, 0));

  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, student_id, status, lesson_type, targets_for_next_session, students(name)") // Fetch all necessary fields
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching bookings:", error);
      showError("Failed to load bookings: " + error.message);
      return;
    }

    const formattedEvents: BigCalendarEvent[] = data.map((booking) => ({
      id: booking.id,
      title: booking.students?.name || booking.title, // Use student name, fallback to booking title
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
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchBookings();
    }
  }, [isSessionLoading, user, fetchBookings]);

  // Recalculate min/max whenever events, current date, or view changes
  useEffect(() => {
    const { min, max } = calculateDynamicTimeRange(currentDate, events, currentView);
    setMinTime(min);
    setMaxTime(max);
  }, [events, currentDate, currentView]);

  const handleNavigate = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
  }, []);

  const handleView = useCallback((newView: string) => {
    setCurrentView(newView);
  }, []);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    onSelectSlot(start, end); // Call the prop function
  }, [onSelectSlot]);

  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    setSelectedBookingId(event.id as string);
    setIsEditBookingDialogOpen(true);
  }, []);

  const handleBookingUpdated = () => {
    fetchBookings(); // Refresh bookings after update
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleBookingDeleted = () => {
    fetchBookings(); // Refresh bookings after deletion
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  return (
    <div className="h-full">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        className="bg-card p-4 rounded-lg shadow-sm"
        views={['month', 'week', 'day', 'agenda']}
        defaultView="week"
        components={{
          toolbar: Toolbar,
          event: (props) => (
            <CalendarEventWrapper
              {...props}
              onEventStatusChange={fetchBookings} // Inject the callback here
            />
          ),
        }}
        min={minTime} // Apply dynamic min time
        max={maxTime} // Apply dynamic max time
        onNavigate={handleNavigate}
        onView={handleView}
        date={currentDate} // Control the calendar's date
        view={currentView} // Control the calendar's view
        selectable // Enable selection of time slots
        onSelectSlot={handleSelectSlot} // Handle slot selection
        onSelectEvent={handleSelectEvent} // Handle event selection
      />

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