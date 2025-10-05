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

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Dummy events for demonstration
const initialEvents: BigCalendarEvent[] = [
  {
    title: 'Lesson with John Doe',
    start: setHours(new Date(), 10, 0, 0, 0),
    end: setHours(new Date(), 11, 0, 0, 0),
  },
  {
    title: 'Early Lesson', // Event outside default range
    start: setHours(new Date(), 7, 30, 0, 0),
    end: setHours(new Date(), 8, 30, 0, 0),
  },
  {
    title: 'Late Lesson', // Event outside default range
    start: setHours(new Date(), 19, 0, 0, 0),
    end: setHours(new Date(), 20, 0, 0, 0),
  },
  {
    title: 'Lesson with Jane Smith',
    start: setHours(new Date(new Date().setDate(new Date().getDate() + 2)), 14, 0, 0, 0),
    end: setHours(new Date(new Date().setDate(new Date().getDate() + 2)), 15, 0, 0, 0),
  },
  {
    title: 'Lesson with Mike Johnson',
    start: setHours(new Date(new Date().setDate(new Date().getDate() + 4)), 16, 0, 0, 0),
    end: setHours(new Date(new Date().setDate(new Date().getDate() + 4)), 17, 0, 0, 0),
  },
];

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

  const weekStart = startOfWeek(currentDate, { locale: locales['en-US'] });
  const weekEnd = endOfWeek(currentDate, { locale: locales['en-US'] });

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

const CalendarComponent: React.FC = () => {
  const [events, setEvents] = useState<BigCalendarEvent[]>(initialEvents);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('week'); // Default view
  const [minTime, setMinTime] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MIN_HOUR, 0, 0, 0));
  const [maxTime, setMaxTime] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), DEFAULT_MAX_HOUR, 0, 0, 0));

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
        }}
        min={minTime} // Apply dynamic min time
        max={maxTime} // Apply dynamic max time
        onNavigate={handleNavigate}
        onView={handleView}
        date={currentDate} // Control the calendar's date
        view={currentView} // Control the calendar's view
      />
    </div>
  );
};

export default CalendarComponent;