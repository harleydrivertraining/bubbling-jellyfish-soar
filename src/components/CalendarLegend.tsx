"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { PoundSterling, X, Check, Circle } from "lucide-react";

const LegendItem = ({ colorClass, label }: { colorClass: string; label: string }) => (
  <div className="flex items-center gap-2">
    <div className={cn("h-3 w-3 rounded-sm shadow-sm", colorClass)} />
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
  </div>
);

const PaymentLegendItem = ({ label, colorClass, overlay }: { label: string, colorClass: string, overlay: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    <div className={cn("relative flex items-center justify-center h-5 w-5 rounded-full", colorClass)}>
      <PoundSterling className="h-3 w-3" />
      {overlay}
    </div>
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
  </div>
);

const CalendarLegend = () => {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 bg-card border rounded-lg shadow-sm mt-4">
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
        overlay={<X className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-600 rounded-full p-0.5 text-white border border-white" />} 
      />
      <PaymentLegendItem 
        label="Covered by Credit" 
        colorClass="text-yellow-600" 
        overlay={<Circle className="absolute inset-0 h-full w-full text-yellow-500 stroke-[2px]" />} 
      />
      <PaymentLegendItem 
        label="Paid" 
        colorClass="text-green-600" 
        overlay={<Check className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-600 rounded-full p-0.5 text-white border border-white" />} 
      />
    </div>
  );
};

export default CalendarLegend;