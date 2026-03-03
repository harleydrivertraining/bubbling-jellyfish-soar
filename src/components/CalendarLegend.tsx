"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { PoundSterling, Circle, Check } from "lucide-center";

const LegendItem = ({ colorClass, label }: { colorClass: string; label: string }) => (
  <div className="flex items-center gap-2">
    <div className={cn("h-3 w-3 rounded-sm shadow-sm", colorClass)} />
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
  </div>
);

const PaymentLegendItem = ({ label, colorClass, circleColor }: { label: string, colorClass: string, circleColor: string }) => (
  <div className="flex items-center gap-2">
    <div className={cn("relative flex items-center justify-center h-5 w-5 rounded-full", colorClass)}>
      <PoundSterling className="h-3 w-3" />
      <Circle className={cn("absolute inset-0 h-full w-full stroke-[2px]", circleColor)} />
    </div>
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
  </div>
);

const CalendarLegend = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 p-4 bg-card border rounded-lg shadow-sm mt-4">
      {/* Lesson Types */}
      <LegendItem colorClass="bg-primary" label="1h Lesson" />
      <LegendItem colorClass="bg-orange-600/80" label="1.5h Lesson" />
      <LegendItem colorClass="bg-sky-500/80" label="2h Lesson" />
      <LegendItem colorClass="bg-yellow-400/80" label="Personal" />
      <LegendItem colorClass="bg-purple-600/80" label="Driving Test" />
      <LegendItem colorClass="bg-green-600/80" label="Completed" />
      <LegendItem colorClass="bg-red-600/80" label="Cancelled" />
      
      {/* Payment Statuses */}
      <PaymentLegendItem 
        label="Unpaid" 
        colorClass="text-red-600" 
        circleColor="text-red-500"
      />
      <PaymentLegendItem 
        label="Covered by Credit" 
        colorClass="text-yellow-600" 
        circleColor="text-yellow-500"
      />
      <PaymentLegendItem 
        label="Paid" 
        colorClass="text-green-600" 
        circleColor="text-green-500"
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          <Circle className="absolute inset-0 h-full w-full stroke-[3px] text-muted-foreground" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Press to complete lesson</span>
      </div>
    </div>
  );
};

export default CalendarLegend;