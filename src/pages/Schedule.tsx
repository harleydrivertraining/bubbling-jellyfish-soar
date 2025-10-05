"use client";

import React from "react";
import CalendarComponent from "@/components/Calendar";

const Schedule: React.FC = () => {
  return (
    <div className="space-y-6 h-full">
      <CalendarComponent />
    </div>
  );
};

export default Schedule;