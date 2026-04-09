"use client";

import React, { useState } from "react";
import { Check, PoundSterling, Circle, Sparkles, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Event as BigCalendarEvent } from 'react-big-calendar';
import { cn } from "@/lib/utils";

interface CustomEventResource {
  student_id: string;
  description?: string;
  status: "scheduled" | "completed" | "cancelled" | "available" | "pending_approval";
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
  const [isOptimisticCompleted, setIsOptimisticCompleted] = useState(false);
  
  const isCompleted = isOptimisticCompleted || event.resource?.status === 'completed';
  const isCancelled = event.resource?.status === 'cancelled';
  const isAvailable = event.resource?.status === 'available';
  const isPending = event.resource?.status === 'pending_approval';
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

    // Optimistic update
    setIsOptimisticCompleted(true);

    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", event.id);

    if (error) {
      console.error("Error marking booking as completed:", error);
      showError("Failed to mark booking as completed: " + error.message);
      setIsOptimisticCompleted(false);
    } else {
      showSuccess("Booking marked as completed!");
      onEventStatusChange();
    }
  };

  const handlePaymentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Disable click if already paid OR covered by credit
    if (isPaid || isCovered) return;
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
      "flex items-center justify-between h-full w-full p-1 transition-colors duration-300",
      {
        "bg-green-600/80": isCompleted,
        "bg-red-600/80": isCancelled,
        "bg-blue-500/20 border-2 border-dashed border-blue-500 text-blue-700": isAvailable,
        "bg-orange-500/20 border-2 border-dashed border-orange-500 text-orange-700": isPending,
        "bg-purple-600/80": isDrivingTest && !isCompleted && !isCancelled && !isPending,
        "bg-yellow-400/80": isPersonal && !isCompleted && !isCancelled && !isPending,
        "bg-orange-600/80": (isDrivingLesson && duration >= 80 && duration <= 100) && !isCompleted && !isCancelled && !isPending,
        "bg-sky-500/80": isDrivingLesson && duration >= 110 && !isCompleted && !isCancelled && !isPending,
      }
    )}>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {isAvailable && <Sparkles className="h-3 w-3 shrink-0" />}
        {isPending && <ClipboardCheck className="h-3 w-3 shrink-0" />}
        <span className={cn(
          "truncate text-[10px] sm:text-xs font-bold",
          (isAvailable || isPending) ? "" : "text-white",
          isAvailable && "text-blue-700",
          isPending && "text-orange-700"
        )}>
          {title}
        </span>
      </div>
      
      <div className="flex items-center gap-1 shrink-0">
        {/* Payment Status Button */}
        {!isPersonal && !isCancelled && !isAvailable && !isPending && (
          <button
            onClick={handlePaymentClick}
            className={cn(
              "relative flex items-center justify-center h-6 w-6 rounded-full transition-all",
              isPaid ? "text-green-300" : isCovered ? "text-yellow-300" : "text-red-300",
              (!isPaid && !isCovered) && "hover:scale-110 active:scale-95"
            )}
            title={isPaid ? "Paid" : isCovered ? "Covered by pre-paid credit" : "Unpaid - Click to pay"}
          >
            <PoundSterling className="h-3.5 w-3.5" />
            
            {/* Circular Overlays */}
            {isPaid ? (
              <Circle className="absolute inset-0 h-full w-full text-green-300 stroke-[3px]" />
            ) : isCovered ? (
              <Circle className="absolute inset-0 h-full w-full text-yellow-300 stroke-[3px]" />
            ) : (
              <Circle className="absolute inset-0 h-full w-full text-red-300 stroke-[3px]" />
            )}
          </button>
        )}

        {/* Completion Button */}
        {!isCompleted && !isCancelled && !isAvailable && !isPending && (
          <button
            onClick={handleMarkAsCompleted}
            className="relative flex items-center justify-center h-6 w-6 rounded-full text-white hover:text-green-300 transition-all hover:scale-110 active:scale-95"
            title="Mark as Completed"
          >
            <Check className="h-3.5 w-3.5" />
            <Circle className="absolute inset-0 h-full w-full stroke-[3px]" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarEventWrapper;