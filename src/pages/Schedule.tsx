"use client";

import React from "react";
import CalendarComponent from "@/components/Calendar";

const Schedule: React.FC = () => {
  return (
    <div className="space-y-6 h-full">
      <h1 className="text-3xl font-bold">Schedule</h1>
      <CalendarComponent />
    </div>
  );
};

export default Schedule;