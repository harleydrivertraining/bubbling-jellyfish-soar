"use client";

import React from "react";
import CalendarComponent from "@/components/Calendar";

const Schedule: React.FC = () => {
  return (
    <div className="flex flex-col space-y-6 h-full">
      <h1 className="text-3xl font-bold">Schedule</h1>
      <div className="flex-1"> {/* This div will take up remaining height */}
        <CalendarComponent />
      </div>
    </div>
  );
};

export default Schedule;