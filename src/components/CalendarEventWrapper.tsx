"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, PoundSterling, X, Check, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Event as BigCalendarEvent } from 'react-big-calendar';
import { cn } from "@/lib/utils";

interface CustomEventResource {
  student_id: string;
  description?: string;
  status: "scheduled" | "completed" | "cancelled";
  lesson_type: string;
  targets_for_next_session?: string;
  is_paid: boolean;
  is_covered: boolean;
}

interface CalendarEventWrapperProps {
  event: BigCalendarEvent & { resource?: CustomEventResource };
  title: string;
  onEventStatusChange: () => void;
  onMarkAsPaid: (bookingId: string, studentId: string, startTime: string, endTime: string) => void;
}

const CalendarEventWrapper: React.FC<CalendarEventWrapperProps> = ({ event, title, onEventStatusChange, onMarkAsPaid }) => {
  const { user } = useSession();
  const isCompleted = event.resource?.status === 'completed';
  const isCancelled = event.resource?.status === 'cancelled';
  const isDrivingTest = event.resource?.lesson_type === 'Driving Test';
  const isPersonal = event.resource?.lesson_type === 'Personal';
  const isDrivingLesson = event.resource?.lesson_type === 'Driving lesson';
  
  const isPaid = event.resource?.is_paid || false;
  const isCovered = event.resource?.is_covered || false;

  const duration = event.start && event.end 
    ? (new Date(event.end).getTime() - new Date(event.start).getTime()) / (1000 * 60)
    : 0;

  const handleMarkAsCompleted = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      onEventStatusChange();
    }
  };

  const handlePaymentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaid) return;
    if (!event.resource?.student_id || !event.start || !event.end) return;

    onMarkAsPaid(
      event.id as string,
      event.resource.student_id,
      event.start.toISOString(),
      event.end.toISOString()
    );
  };

  return (
    <div className={cn(
      "flex items-center justify-between h-full w-full p-1",
      {
        "bg-green-600/80": isCompleted,
        "bg-red-600/80": isCancelled,
        "bg-purple-600/80": isDrivingTest && !isCompleted && !isCancelled,
        "bg-yellow-400/80": isPersonal && !isCompleted && !isCancelled,
        "bg-orange-600/80": (isDrivingLesson && duration >= 80 && duration <= 100) && !isCompleted && !isCancelled,
        "bg-sky-500/80": isDrivingLesson && duration >= 110 && !isCompleted && !isCancelled,
      }
    )}>
      <span className="flex-1 truncate text-white text-[10px] sm:text-xs font-bold">{title}</span>
      
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Payment Status Button */}
        {!isPersonal && !isCancelled && (
          <button
            onClick={handlePaymentClick}
            className={cn(
              "relative flex items-center justify-center h-6 w-6 rounded-full transition-all",
              isPaid ? "text-green-300" : isCovered ? "text-yellow-300" : "text-red-300",
              !isPaid && "hover:scale-110 active:scale-95"
            )}
            title={isPaid ? "Paid" : isCovered ? "Covered by credit - Click to pay" : "Unpaid - Click to pay"}
          >
            <PoundSterling className="h-3.5 w-3.5" />
            
            {/* Overlays */}
            {isPaid ? (
              <Check className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-green-600 rounded-full p-0.5 text-white border border-white" />
            ) : isCovered ? (
              <Circle className="absolute inset-0 h-full w-full text-yellow-300 stroke-[3px]" />
            ) : (
              <X className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-red-600 rounded-full p-0.5 text-white border border-white" />
            )}
          </button>
        )}

        {/* Completion Button */}
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
    </div>
  );
};

export default CalendarEventWrapper;