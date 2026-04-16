"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Sparkles, 
  CalendarDays, 
  Clock, 
  Info, 
  ClipboardCheck, 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  format, 
  addHours, 
  isBefore, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  differenceInMinutes
} from "date-fns";

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
  const [isLoading, setIsLoading] = useState(true);
  const [studentData, setStudentData] = useState<any>(null);
  const [instructor, setInstructor] = useState<any>(null);
  const [availableSlots, setAvailableSlots] = useState<Booking[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Booking | null>(null);
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
        .select("first_name, last_name, calendar_start_hour, calendar_end_hour, min_booking_notice_hours, require_booking_approval")
        .eq("id", sData.user_id)
        .single();
      
      setInstructor(instructorProfile);

      const { data: bookingsData, error: bError } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", sData.user_id)
        .eq("status", "available")
        .gte("start_time", startOfMonth(currentMonth).toISOString())
        .lte("end_time", endOfMonth(addMonths(currentMonth, 1)).toISOString());

      if (bError) throw bError;
      setAvailableSlots(bookingsData || []);
    } catch (error: any) {
      console.error("Error fetching calendar data:", error);
      showError("Failed to load calendar.");
    } finally {
      setIsLoading(false);
    }
  }, [user, currentMonth]);

  useEffect(() => {
    if (!isSessionLoading) fetchData();
  }, [isSessionLoading, fetchData]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const slotsForSelectedDate = useMemo(() => {
    return availableSlots.filter(slot => isSameDay(parseISO(slot.start_time), selectedDate));
  }, [availableSlots, selectedDate]);

  const hasSlots = (date: Date) => {
    return availableSlots.some(slot => isSameDay(parseISO(slot.start_time), date));
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !studentData || !instructor) return;

    setIsBooking(true);
    try {
      const requireApproval = instructor.require_booking_approval ?? false;
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

      await supabase.from("notifications").insert({
        user_id: studentData.user_id,
        title: requireApproval ? "New Booking Request!" : "New Lesson Booked!",
        message: `${studentData.name} has ${requireApproval ? 'requested' : 'booked'} the slot on ${format(parseISO(selectedSlot.start_time), "PPP p")}.`,
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

  if (isSessionLoading || isLoading) {
    return <div className="p-6 space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="-ml-2">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
          </Button>
          <h1 className="text-2xl font-black tracking-tight">Book a Lesson</h1>
        </div>
      </div>

      {/* Monthly Calendar Grid */}
      <Card className="shadow-sm border-none overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-center text-[10px] font-black text-muted-foreground uppercase py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-2">
            {days.map((day, i) => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const available = hasSlots(day);
              
              return (
                <div key={i} className="flex justify-center items-center aspect-square">
                  <button
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-all relative",
                      !isCurrentMonth && "text-muted-foreground/30",
                      isCurrentMonth && "text-foreground",
                      isSelected && "bg-primary text-primary-foreground scale-110 shadow-md",
                      (available && !isSelected) && "border-2 border-blue-500 text-blue-600"
                    )}
                  >
                    {format(day, "d")}
                    {(available && !isSelected) && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-500" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Available Slots List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {isSameDay(selectedDate, new Date()) ? "Today's Slots" : format(selectedDate, "EEEE, do MMM")}
          </h3>
          <Badge variant="secondary" className="font-bold">
            {slotsForSelectedDate.length} Available
          </Badge>
        </div>

        {slotsForSelectedDate.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="p-8 text-center space-y-2">
              <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground font-medium">No slots available on this day.</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Try another date highlighted in blue</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {slotsForSelectedDate.map((slot) => {
              const start = parseISO(slot.start_time);
              const duration = differenceInMinutes(parseISO(slot.end_time), start) / 60;
              const noticeHours = instructor?.min_booking_notice_hours ?? 48;
              const isTooSoon = isBefore(start, addHours(new Date(), noticeHours));

              return (
                <Card key={slot.id} className={cn(
                  "overflow-hidden border-l-4 transition-all",
                  isTooSoon ? "border-l-muted opacity-60" : "border-l-blue-500 hover:shadow-md"
                )}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-lg">{format(start, "p")}</p>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase h-5">
                          {duration.toFixed(1)}h Lesson
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Ends at {format(parseISO(slot.end_time), "p")}
                      </p>
                    </div>

                    {isTooSoon ? (
                      <div className="text-right">
                        <Badge variant="secondary" className="text-[8px] font-black uppercase">Too Soon</Badge>
                        <p className="text-[8px] text-muted-foreground mt-1">{noticeHours}h notice req.</p>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        className={cn(
                          "font-bold", 
                          instructor?.require_booking_approval ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"
                        )}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {instructor?.require_booking_approval ? "Request" : "Book Now"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Confirmation Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {instructor?.require_booking_approval ? <ClipboardCheck className="h-5 w-5 text-orange-600" /> : <Sparkles className="h-5 w-5 text-blue-600" />}
              {instructor?.require_booking_approval ? "Request Booking" : "Confirm Booking"}
            </DialogTitle>
            <DialogDescription>
              {instructor?.require_booking_approval 
                ? "This slot requires instructor approval. Send a request?" 
                : "Would you like to book this lesson slot?"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSlot && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted rounded-xl space-y-2 border">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {format(parseISO(selectedSlot.start_time), "EEEE, MMMM do")}
                </div>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Clock className="h-4 w-4 text-primary" />
                  {format(parseISO(selectedSlot.start_time), "p")} — {format(parseISO(selectedSlot.end_time), "p")}
                </div>
              </div>
              
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  {instructor?.require_booking_approval 
                    ? "Your instructor will be notified and can approve or decline your request." 
                    : "Once confirmed, this lesson will be added to your schedule immediately."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSelectedSlot(null)} disabled={isBooking} className="font-bold">Cancel</Button>
            <Button 
              onClick={handleConfirmBooking} 
              disabled={isBooking} 
              className={cn(
                "font-bold flex-1 sm:flex-none", 
                instructor?.require_booking_approval ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isBooking ? "Processing..." : instructor?.require_booking_approval ? "Send Request" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentCalendar;