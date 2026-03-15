"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import endOfWeek from 'date-fns/endOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import Toolbar from 'react-big-calendar/lib/Toolbar';
import { isWithinInterval, getHours, getMinutes, startOfDay, endOfDay, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EditBookingForm from "@/components/EditBookingForm";
import CalendarEventWrapper from "@/components/CalendarEventWrapper";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1, locale: locales['en-US'] }),
  getDay,
  locales,
});

const DEFAULT_MIN_HOUR = 9;
const DEFAULT_MAX_HOUR = 18;

const calculateDynamicTimeRange = (currentDate: Date, events: BigCalendarEvent[], currentView: string) => {
  if (currentView === 'month' || currentView === 'agenda') {
    return { min: undefined, max: undefined };
  }

  let minHour = DEFAULT_MIN_HOUR;
  let maxHour = DEFAULT_MAX_HOUR;

  // Filter events to only those visible in the current view
  const visibleEvents = events.filter(event => {
    const start = event.start instanceof Date ? event.start : new Date(event.start!);
    
    if (currentView === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return isWithinInterval(start, { start: weekStart, end: weekEnd });
    } else if (currentView === 'day') {
      return isWithinInterval(start, { start: startOfDay(currentDate), end: endOfDay(currentDate) });
    }
    return true;
  });

  if (visibleEvents.length > 0) {
    let earliestEventHour = 24;
    let latestEventHour = 0;

    visibleEvents.forEach(event => {
      const start = event.start instanceof Date ? event.start : new Date(event.start!);
      const end = event.end instanceof Date ? event.end : new Date(event.end!);

      const sHour = getHours(start);
      const eHour = getHours(end) + (getMinutes(end) > 0 ? 1 : 0);

      if (sHour < earliestEventHour) earliestEventHour = sHour;
      if (eHour > latestEventHour) latestEventHour = eHour;
    });

    if (earliestEventHour < DEFAULT_MIN_HOUR) {
      minHour = earliestEventHour;
    }
    if (latestEventHour > DEFAULT_MAX_HOUR) {
      maxHour = latestEventHour;
    }
  }

  const minDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), minHour, 0, 0);
  const maxDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), maxHour, 0, 0);

  return { min: minDate, max: maxDate };
};

interface CalendarComponentProps {
  events: BigCalendarEvent[];
  onEventsRefetch: (startDate: Date, endDate: Date) => void;
  onSelectSlot: (start: Date, end: Date) => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  currentView: 'month' | 'week' | 'day' | 'agenda';
  setCurrentView: (view: 'month' | 'week' | 'day' | 'agenda') => void;
  onMarkAsPaid: (bookingId: string, studentId: string, startTime: string, endTime: string) => void;
}

const CalendarComponent: React.FC<CalendarComponentProps> = ({
  events,
  onEventsRefetch,
  onSelectSlot,
  currentDate,
  setCurrentDate,
  currentView,
  setCurrentView,
  onMarkAsPaid,
}) => {
  const { user } = useSession();

  const { minTime, maxTime } = useMemo(() => {
    return calculateDynamicTimeRange(currentDate, events, currentView);
  }, [events, currentDate, currentView]);

  const handleNavigate = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
  }, [setCurrentDate]);

  const handleView = useCallback((newView: string) => {
    setCurrentView(newView as 'month' | 'week' | 'day' | 'agenda');
  }, [setCurrentView]);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    onSelectSlot(start, end);
  }, [onSelectSlot]);

  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    setSelectedBookingId(event.id as string);
    setIsEditBookingDialogOpen(true);
  }, []);

  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const handleBookingUpdated = () => {
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
      const start = startOfMonth(currentDate);
      const end = endOfMonth(addMonths(currentDate, 2));
      onEventsRefetch(start, end);
    }
  }, [user, currentDate, onEventsRefetch]);

  const scrollToTime = useMemo(() => new Date(1970, 1, 1, 9, 0, 0), []);

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
                onEventStatusChange={handleBookingUpdated}
                onMarkAsPaid={onMarkAsPaid}
              />
            ),
          }}
          min={minTime}
          max={maxTime}
          scrollToTime={scrollToTime}
          onNavigate={handleNavigate}
          date={currentDate}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      <Dialog open={isEditBookingDialogOpen} onOpenChange={setIsEditBookingDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {selectedBookingId && (
            <EditBookingForm
              bookingId={selectedBookingId}
              onBookingUpdated={handleBookingUpdated}
              onBookingDeleted={handleBookingUpdated}
              onClose={() => setIsEditBookingDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarComponent;