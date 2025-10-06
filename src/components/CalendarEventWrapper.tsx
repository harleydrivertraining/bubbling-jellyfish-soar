"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Event as BigCalendarEvent } from 'react-big-calendar';
import { cn } from "@/lib/utils";

interface CustomEventResource {
  student_id: string;
  description?: string;
  status: "scheduled" | "completed" | "cancelled"; // Define possible statuses
  lesson_type: string;
  targets_for_next_session?: string;
}

interface CalendarEventWrapperProps {
  event: BigCalendarEvent & { resource?: CustomEventResource }; // Extend BigCalendarEvent with custom resource
  title: string;
  onEventStatusChange: () => void; // Callback to refresh calendar events
}

const CalendarEventWrapper: React.FC<CalendarEventWrapperProps> = ({ event, title, onEventStatusChange }) => {
  const { user } = useSession();
  const isCompleted = event.resource?.status === 'completed';
  const isCancelled = event.resource?.status === 'cancelled';
  const isDrivingTest = event.resource?.lesson_type === 'Driving Test'; // Check for Driving Test
  const isPersonal = event.resource?.lesson_type === 'Personal'; // Check for Personal booking type

  const handleMarkAsCompleted = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event click from opening edit dialog

    if (!user) {
      showError("You must be logged in to update a booking.");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", event.id);

    if (error) {
      console.error("Error marking booking as completed:", error);
      showError("Failed to mark booking as completed: " + error.message);
    } else {
      showSuccess("Booking marked as completed!");
      onEventStatusChange(); // Refresh calendar events
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between h-full w-full p-1",
      {
        "bg-green-600/80": isCompleted,
        "bg-red-600/80": isCancelled,
        "bg-purple-600/80": isDrivingTest && !isCompleted && !isCancelled,
        "bg-orange-600/80": isPersonal && !isCompleted && !isCancelled, // Apply orange if it's a personal booking and not completed/cancelled
      }
    )}>
      <span className="flex-1 truncate text-white text-xs font-medium">{title}</span>
      {!isCompleted && !isCancelled && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMarkAsCompleted}
          className="h-6 w-6 text-white hover:text-green-300 hover:bg-transparent p-0"
          title="Mark as Completed"
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default CalendarEventWrapper;