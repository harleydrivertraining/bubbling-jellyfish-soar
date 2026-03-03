"use client";

import React from "react";
import { cn } from "@/lib/utils";

const LegendItem = ({ colorClass, label }: { colorClass: string; label: string }) => (
  <div className="flex items-center gap-2">
    <div className={cn("h-3 w-3 rounded-sm shadow-sm", colorClass)} />
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
  </div>
);

const CalendarLegend = () => {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 p-4 bg-card border rounded-lg shadow-sm mt-4">
      <LegendItem colorClass="bg-primary" label="1h Lesson" />
      <LegendItem colorClass="bg-orange-600/80" label="1.5h Lesson / Personal" />
      <LegendItem colorClass="bg-sky-500/80" label="2h Lesson" />
      <LegendItem colorClass="bg-purple-600/80" label="Driving Test" />
      <LegendItem colorClass="bg-green-600/80" label="Completed" />
      <LegendItem colorClass="bg-red-600/80" label="Cancelled" />
    </div>
  );
};

export default CalendarLegend;