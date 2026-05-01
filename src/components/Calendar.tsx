"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent } from 'react-big-calendar';
import { 
  format, 
  parse, 
  startOfWeek, 
  endOfWeek, 
  getDay, 
  isWithinInterval, 
  getHours, 
  getMinutes, 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  addMonths 
} from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
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
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const calculateDynamicTimeRange = (currentDate: Date, events: BigCalendarEvent[], currentView: string, defaultMin: number, defaultMax: number) => {
  if (currentView === 'month' || currentView === 'agenda') {
    return { min: undefined, max: undefined };
  }

  let minHour = defaultMin;
  let maxHour = defaultMax;

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

    if (earliestEventHour < defaultMin) minHour = earliestEventHour;
    if (latestEventHour > defaultMax) maxHour = latestEventHour;
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
  defaultStartHour?: number;
  defaultEndHour?: number;
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
  defaultStartHour = 9,
  defaultEndHour = 18,
}) => {
  const { user } = useSession();
  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const { min: minTime, max: maxTime } = useMemo(() => {
    return calculateDynamicTimeRange(currentDate, events, currentView, defaultStartHour, defaultEndHour);
  }, [events, currentDate, currentView, defaultStartHour, defaultEndHour]);

  const handleNavigate = useCallback((newDate: Date) => setCurrentDate(newDate), [setCurrentDate]);
  const handleView = useCallback((newView: string) => setCurrentView(newView as 'month' | 'week' | 'day' | 'agenda'), [setCurrentView]);
  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => onSelectSlot(start, end), [onSelectSlot]);
  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    setSelectedBookingId(event.id as string);
    setIsEditBookingDialogOpen(true);
  }, []);

  const handleBookingUpdated = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(addMonths(currentDate, 2));
    onEventsRefetch(start, end);
    setIsEditBookingDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleMarkAllDayBookingsAsCompleted = useCallback(async () => {
    if (!user) return;
    const startOfCurrentDay = startOfDay(currentDate);
    const endOfCurrentDay = endOfDay(currentDate);
    const { data: bookingsToUpdate } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .gte("start_time", startOfCurrentDay.toISOString())
      .lte("end_time", endOfCurrentDay.toISOString());

    if (!bookingsToUpdate || bookingsToUpdate.length === 0) {
      showError("No scheduled bookings found for this day.");
      return;
    }

    const { error } = await supabase.from("bookings").update({ status: "completed" }).in("id", bookingsToUpdate.map(b => b.id));
    if (error) showError("Failed to update bookings.");
    else {
      showSuccess("Bookings marked as completed!");
      onEventsRefetch(startOfMonth(currentDate), endOfMonth(addMonths(currentDate, 2)));
    }
  }, [user, currentDate, onEventsRefetch]);

  const scrollToTime = useMemo(() => new Date(1970, 1, 1, defaultStartHour, 0, 0), [defaultStartHour]);

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
          <DialogHeader><DialogTitle>Edit Booking</DialogTitle></DialogHeader>
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