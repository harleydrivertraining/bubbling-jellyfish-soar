"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, Event as BigCalendarEvent } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, CalendarDays, Clock, Check, Info, AlertCircle, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { addHours, isBefore } from "date-fns";

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  lesson_type: string;
}

const StudentCalendar: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<BigCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentData, setStudentData] = useState<any>(null);
  const [calendarHours, setCalendarHours] = useState({ start: 9, end: 18 });
  const [minNoticeHours, setMinNoticeHours] = useState(48);
  const [requireApproval, setRequireApproval] = useState(false);
  
  const [selectedSlot, setSelectedSlot] = useState<BigCalendarEvent | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: sData, error: sError } = await supabase
        .from("students")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();

      if (sError) throw sError;
      setStudentData(sData);

      const { data: instructorProfile } = await supabase
        .from("profiles")
        .select("calendar_start_hour, calendar_end_hour, min_booking_notice_hours, require_booking_approval")
        .eq("id", sData.user_id)
        .single();
      
      if (instructorProfile) {
        setCalendarHours({
          start: instructorProfile.calendar_start_hour ?? 9,
          end: instructorProfile.calendar_end_hour ?? 18
        });
        setMinNoticeHours(instructorProfile.min_booking_notice_hours ?? 48);
        setRequireApproval(instructorProfile.require_booking_approval ?? false);
      }

      const { data: bookingsData, error: bError } = await supabase
        .from("bookings")
        .select("*")
        .or(`student_id.eq.${sData.id},status.eq.available`)
        .eq("user_id", sData.user_id);

      if (bError) throw bError;

      const formattedEvents: BigCalendarEvent[] = (bookingsData || []).map(b => ({
        id: b.id,
        title: b.status === 'available' ? "Available Slot" : b.status === 'pending_approval' ? "Pending Approval" : b.lesson_type,
        start: new Date(b.start_time),
        end: new Date(b.end_time),
        resource: {
          status: b.status,
          lesson_type: b.lesson_type,
          id: b.id
        }
      }));

      setEvents(formattedEvents);
    } catch (error: any) {
      console.error("Error fetching calendar data:", error);
      showError("Failed to load calendar.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchData();
  }, [isSessionLoading, fetchData]);

  const handleSelectEvent = (event: BigCalendarEvent) => {
    if (event.resource?.status === 'available') {
      const now = new Date();
      const minBookingTime = addHours(now, minNoticeHours);
      
      if (isBefore(event.start!, minBookingTime)) {
        showError(`This slot is too soon. Your instructor requires at least ${minNoticeHours} hours notice.`);
        return;
      }
      
      setSelectedSlot(event);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !studentData) return;

    setIsBooking(true);
    try {
      const newStatus = requireApproval ? "pending_approval" : "scheduled";
      const displayTitle = requireApproval 
        ? `${studentData.name} - Pending Approval` 
        : `${studentData.name} - Driving lesson`;

      const { error } = await supabase
        .from("bookings")
        .update({
          student_id: studentData.id,
          status: newStatus,
          title: displayTitle,
          lesson_type: "Driving lesson"
        })
        .eq("id", selectedSlot.id);

      if (error) throw error;

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: studentData.user_id,
        title: requireApproval ? "New Booking Request!" : "New Lesson Booked!",
        message: `${studentData.name} has ${requireApproval ? 'requested' : 'booked'} the slot on ${format(selectedSlot.start!, "PPP p")}.`,
        type: "booking_claimed"
      });

      showSuccess(requireApproval ? "Request sent! Waiting for instructor approval." : "Lesson booked successfully!");
      setSelectedSlot(null);
      fetchData();
    } catch (error: any) {
      showError("Failed to book lesson: " + error.message);
    } finally {
      setIsBooking(false);
    }
  };

  const eventPropGetter = (event: BigCalendarEvent) => {
    const status = event.resource?.status;
    let className = "rounded-md border-none shadow-sm ";
    
    if (status === 'available') {
      const now = new Date();
      const minBookingTime = addHours(now, minNoticeHours);
      const isTooSoon = isBefore(event.start!, minBookingTime);
      
      if (isTooSoon) {
        className += "bg-muted border-2 border-dashed border-muted-foreground/30 text-muted-foreground opacity-50 cursor-not-allowed";
      } else {
        className += "bg-blue-500/20 border-2 border-dashed border-blue-500 text-blue-700 font-bold";
      }
    } else if (status === 'pending_approval') {
      className += "bg-orange-500/20 border-2 border-dashed border-orange-500 text-orange-700 font-bold";
    } else if (status === 'completed') {
      className += "bg-green-600 text-white opacity-80";
    } else if (status === 'cancelled') {
      className += "bg-red-600 text-white opacity-50";
    } else {
      className += "bg-primary text-primary-foreground";
    }

    return { className };
  };

  if (isSessionLoading || isLoading) {
    return <div className="p-6 space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[600px] w-full" /></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="-ml-2">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
          </Button>
          <h1 className="text-3xl font-black tracking-tight">Available Lessons</h1>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-bold">How to book:</p>
          <p>Click on any <span className="font-bold text-blue-600">available slot</span> to book a lesson. {requireApproval && "Your instructor will need to approve the request."}</p>
        </div>
      </div>

      <div className="flex-1 min-h-[600px] bg-card p-4 rounded-xl border shadow-sm">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={['month', 'week', 'day']}
          defaultView={isMobile ? 'day' : 'week'}
          eventPropGetter={eventPropGetter}
          onSelectEvent={handleSelectEvent}
          min={new Date(0, 0, 0, calendarHours.start, 0, 0)}
          max={new Date(0, 0, 0, calendarHours.end, 0, 0)}
        />
      </div>

      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {requireApproval ? <ClipboardCheck className="h-5 w-5 text-orange-600" /> : <CalendarDays className="h-5 w-5 text-blue-600" />}
              {requireApproval ? "Request Booking" : "Confirm Booking"}
            </DialogTitle>
            <DialogDescription>
              {requireApproval 
                ? "This slot requires instructor approval. Send a request?" 
                : "Would you like to book this extra lesson slot?"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSlot && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {format(selectedSlot.start!, "EEEE, MMMM do")}
                </div>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {format(selectedSlot.start!, "p")} — {format(selectedSlot.end!, "p")}
                </div>
              </div>
              
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 p-3 rounded border border-blue-100">
                <Info className="h-4 w-4 text-blue-500 shrink-0" />
                <p>
                  {requireApproval 
                    ? "Your instructor will be notified and can approve or decline your request." 
                    : "Once confirmed, this lesson will be added to your schedule and your instructor will be notified."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSelectedSlot(null)} disabled={isBooking}>Cancel</Button>
            <Button onClick={handleConfirmBooking} disabled={isBooking} className={cn("font-bold", requireApproval ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700")}>
              {isBooking ? "Processing..." : requireApproval ? "Send Request" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentCalendar;