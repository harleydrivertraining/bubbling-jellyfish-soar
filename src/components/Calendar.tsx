"use client";

import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import Toolbar from 'react-big-calendar/lib/addons/toolbar'; // Import Toolbar

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
const initialEvents = [
  {
    title: 'Lesson with John Doe',
    start: new Date(new Date().setHours(10, 0, 0, 0)),
    end: new Date(new Date().setHours(11, 0, 0, 0)),
  },
  {
    title: 'Lesson with Jane Smith',
    start: new Date(new Date().setDate(new Date().getDate() + 2)),
    end: new Date(new Date().setDate(new Date().getDate() + 2)),
  },
  {
    title: 'Lesson with Mike Johnson',
    start: new Date(new Date().setDate(new Date().getDate() + 4)),
    end: new Date(new Date().setDate(new Date().getDate() + 4)),
  },
];

const CalendarComponent: React.FC = () => {
  const [events, setEvents] = useState(initialEvents);

  return (
    <div className="h-[calc(100vh-160px)]"> {/* Adjust height to fit the layout */}
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        className="bg-card p-4 rounded-lg shadow-sm"
        views={['month', 'week', 'day', 'agenda']} // Added views
        defaultView="month" // Set default view
        components={{
          toolbar: Toolbar, // Explicitly use the Toolbar
        }}
      />
    </div>
  );
};

export default CalendarComponent;