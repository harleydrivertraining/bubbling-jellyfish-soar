"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const Schedule: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Schedule</h1>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>Tomorrow, 10:00 AM - John Doe</li>
            <li>Wednesday, 2:00 PM - Jane Smith</li>
            <li>Friday, 9:00 AM - Mike Johnson</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Schedule;