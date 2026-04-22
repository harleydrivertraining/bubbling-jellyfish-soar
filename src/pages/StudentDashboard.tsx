"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, parseISO, differenceInMinutes, addHours, startOfDay, setHours, setMinutes, addWeeks } from "date-fns";
import { 
  GraduationCap, 
  CalendarDays, 
  Hourglass, 
  TrendingUp, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  User,
  MessageSquare,
  Target,
  LogOut,
  ArrowRight,
  Star,
  Sparkles,
  Plus,
  RefreshCw,
  ClipboardCheck,
  AlertCircle,
  Bell,
  X,
  XCircle,
  LayoutDashboard,
  Inbox,
  Megaphone
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import StudentBookingStatusCard from "@/components/StudentBookingStatusCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageConversation from "@/components/MessageConversation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  lesson_type: string;
  description?: string;
  targets_for_next_session?: string;
}

const StudentDashboard: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  
  const [isBooking, setIsBooking] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/login";
    }
  };

  // 1. Get Student Record
  const { data: student, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("auth_user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // 2. Get Instructor Info
  const { data: instructor, isLoading: isLoadingInstructor } = useQuery({
    queryKey: ['instructor-profile', student?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", student!.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!student?.user_id,
  });

  // 3. Get Bookings (Next 2 weeks for gap calculation)
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ['student-bookings', student?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("student_id", student!.id)
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    },
    enabled: !!student?.id,
  });

  // 4. Get All Instructor Bookings (to find gaps)
  const { data: allInstructorBookings = [] } = useQuery({
    queryKey: ['instructor-all-bookings', student?.user_id],
    queryFn: async () => {
      const start = new Date().toISOString();
      const end = addWeeks(new Date(), 2).toISOString();
      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status")
        .eq("user_id", student!.user_id)
        .gte("start_time", start)
        .lte("end_time", end)
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
    enabled: !!student?.user_id,
  });

  // 5. Calculate Available Slots (Dynamic Logic)
  const availableSlots = useMemo(() => {
    if (!instructor || !student) return [];

    const mode = instructor.booking_mode || "gaps";
    const now = new Date();
    const noticeHours = instructor.min_booking_notice_hours ?? 48;
    const advanceWeeks = instructor.max_booking_advance_weeks ?? 12;
    const minStartTimeMs = addHours(now, noticeHours).getTime();
    const maxStartTimeMs = addWeeks(now, advanceWeeks).getTime();
    const durationMs = 60 * 60000; // Default to 1 hour for dashboard preview
    const intervalMs = Math.max(15, instructor.booking_interval_mins || 30) * 60000;
    const bufferMs = (instructor.booking_buffer_mins || 0) * 60000;

    const busyPeriods = allInstructorBookings
      .filter(b => b.status !== 'available')
      .map(b => ({
        start: parseISO(b.start_time).getTime() - bufferMs,
        end: parseISO(b.end_time).getTime() + bufferMs
      }));

    const slots: any[] = [];
    const daysToSearch = 14; // Look ahead 2 weeks for the dashboard

    for (let i = 0; i < daysToSearch; i++) {
      const day = addHours(startOfDay(now), i * 24);
      const dateKey = format(day, 'yyyy-MM-dd');
      
      if (mode === "gaps") {
        const manualGaps = allInstructorBookings.filter(b => b.status === 'available' && b.start_time.startsWith(dateKey));
        manualGaps.forEach(gap => {
          const gapStartMs = parseISO(gap.start_time).getTime();
          const gapEndMs = parseISO(gap.end_time).getTime();
          let currentPointerMs = gapStartMs;
          while (currentPointerMs + durationMs <= gapEndMs && slots.length < 5) {
            const endPointerMs = currentPointerMs + durationMs;
            const isClashing = busyPeriods.some(busy => currentPointerMs < busy.end && endPointerMs > busy.start);
            if (currentPointerMs >= minStartTimeMs && currentPointerMs <= maxStartTimeMs && !isClashing) {
              slots.push({ id: `gap-${gap.id}-${currentPointerMs}`, start_time: new Date(currentPointerMs).toISOString(), end_time: new Date(endPointerMs).toISOString() });
            }
            currentPointerMs += intervalMs;
          }
        });
      } else {
        const dayOfWeek = day.getDay().toString();
        const dayConfig = instructor.working_hours?.[dayOfWeek];
        if (dayConfig?.active) {
          const parseTime = (t: any) => (t || "09:00").split(':').map(Number);
          const [startH, startM] = parseTime(dayConfig.start);
          const [endH, endM] = parseTime(dayConfig.end);
          const dayStartMs = setMinutes(setHours(startOfDay(day), startH), startM).getTime();
          const dayEndMs = setMinutes(setHours(startOfDay(day), endH), endM).getTime();

          let currentPointerMs = dayStartMs;
          while (currentPointerMs + durationMs <= dayEndMs && slots.length < 5) {
            const endPointerMs = currentPointerMs + durationMs;
            const isClashing = busyPeriods.some(busy => currentPointerMs < busy.end && endPointerMs > busy.start);
            if (currentPointerMs >= minStartTimeMs && currentPointerMs <= maxStartTimeMs && !isClashing) {
              slots.push({ id: `gen-${currentPointerMs}`, start_time: new Date(currentPointerMs).toISOString(), end_time: new Date(endPointerMs).toISOString() });
            }
            currentPointerMs += intervalMs;
          }
        }
      }
      if (slots.length >= 5) break;
    }
    return slots;
  }, [instructor, student, allInstructorBookings]);

  // 6. Get Messages
  const { data: directMessages = [] } = useQuery({
    queryKey: ['student-messages', student?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructor_messages")
        .select("*")
        .or(`student_id.eq.${student!.id},is_broadcast.eq.true`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!student?.id,
  });

  // 7. Get Pre-paid Hours
  const { data: totalCredit = 0 } = useQuery({
    queryKey: ['student-credit', student?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_paid_hours")
        .select("remaining_hours")
        .eq("student_id", student!.id);
      if (error) throw error;
      return data?.reduce((sum, pkg) => sum + (pkg.remaining_hours || 0), 0) || 0;
    },
    enabled: !!student?.id,
  });

  // 8. Get Notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['student-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // 9. Calculate Progress
  const { data: progressPercentage = 0 } = useQuery({
    queryKey: ['student-progress-stats', student?.id, student?.user_id],
    queryFn: async () => {
      const [topicsRes, hiddenRes, entriesRes] = await Promise.all([
        supabase.from("progress_topics").select("id").or(`user_id.eq.${student!.user_id},is_default.eq.true`),
        supabase.from("hidden_progress_topics").select("topic_id").eq("user_id", student!.user_id),
        supabase.from("student_progress_entries").select("topic_id, rating").eq("student_id", student!.id).order("entry_date", { ascending: false })
      ]);

      const hiddenIds = new Set((hiddenRes.data || []).map(h => h.topic_id));
      const visibleTopicsCount = (topicsRes.data || []).filter(t => !hiddenIds.has(t.id)).length;

      if (visibleTopicsCount > 0) {
        const latestRatings: Record<string, number> = {};
        entriesRes.data?.forEach(entry => {
          if (!latestRatings[entry.topic_id]) latestRatings[entry.topic_id] = entry.rating;
        });
        const totalStars = Object.values(latestRatings).reduce((sum, r) => sum + r, 0);
        return Math.round((totalStars / (visibleTopicsCount * 5)) * 100);
      }
      return 0;
    },
    enabled: !!student?.id,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`student-dashboard-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => queryClient.invalidateQueries({ queryKey: ['student-notifications'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['student-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['instructor-all-bookings'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instructor_messages' }, () => queryClient.invalidateQueries({ queryKey: ['student-messages'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const handleMarkNotifRead = async (id: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (!error) queryClient.invalidateQueries({ queryKey: ['student-notifications'] });
  };

  const handleBookSlot = async (slot: any) => {
    if (!student || !instructor) return;
    setIsBooking(slot.id);
    try {
      const requireApproval = instructor.require_booking_approval ?? false;
      const newStatus = requireApproval ? "pending_approval" : "scheduled";
      const displayTitle = requireApproval ? `${student.name} - Pending Approval` : `${student.name} - Driving lesson`;

      const { error } = await supabase.from("bookings").insert({ 
        user_id: student.user_id,
        student_id: student.id, 
        status: newStatus, 
        title: displayTitle, 
        lesson_type: "Driving lesson",
        start_time: slot.start_time,
        end_time: slot.end_time
      });
      
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: student.user_id,
        title: requireApproval ? "New Booking Request!" : "New Lesson Booked!",
        message: `${student.name} has ${requireApproval ? 'requested' : 'booked'} the slot on ${format(parseISO(slot.start_time), "PPP p")}.`,
        type: "booking_claimed"
      });

      showSuccess(requireApproval ? "Request sent! Waiting for instructor approval." : "Lesson booked successfully!");
      queryClient.invalidateQueries({ queryKey: ['student-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-all-bookings'] });
    } catch (error: any) {
      showError("Failed to book lesson: " + error.message);
    } finally {
      setIsBooking(null);
    }
  };

  const upcomingLesson = useMemo(() => {
    return bookings.find(b => b.status === 'scheduled' && isAfter(parseISO(b.start_time), new Date()));
  }, [bookings]);

  const bookingActivity = useMemo(() => {
    const activity: any[] = [];
    bookings.filter(b => b.status === 'pending_approval' && isAfter(parseISO(b.start_time), new Date())).forEach(b => {
      activity.push({ id: b.id, start_time: b.start_time, status: b.status, type: 'pending', title: "Pending Approval" });
    });
    notifications.filter(n => !n.read).forEach(n => {
      if (n.type === 'booking_confirmed' || n.type === 'booking_rejected') {
        activity.push({ id: n.id, start_time: n.created_at, status: n.type === 'booking_confirmed' ? 'scheduled' : 'rejected', type: n.type === 'booking_confirmed' ? 'accepted' : 'rejected', title: n.title, message: n.message, notificationId: n.id });
      }
    });
    return activity.sort((a, b) => parseISO(b.start_time).getTime() - parseISO(a.start_time).getTime());
  }, [bookings, notifications]);

  const combinedMessages = useMemo(() => {
    const items: any[] = [];
    bookings.filter(b => b.status === 'completed' && (b.description || b.targets_for_next_session)).forEach(b => {
      items.push({ id: b.id, type: 'lesson_note', date: b.start_time, title: format(parseISO(b.start_time), "EEEE, MMMM do"), subtitle: b.lesson_type, content: b.description, targets: b.targets_for_next_session });
    });
    directMessages.forEach(m => {
      items.push({ id: m.id, type: 'direct_message', date: m.created_at, title: m.is_broadcast ? "Announcement" : "Private Message", subtitle: "From Instructor", content: m.content, is_broadcast: m.is_broadcast, instructor_id: m.instructor_id });
    });
    return items.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [bookings, directMessages]);

  if (isSessionLoading || isLoadingStudent || isLoadingInstructor) {
    return <div className="space-y-6 p-6"><Skeleton className="h-10 w-48" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div></div>;
  }

  return (
    <div className="space-y-8 w-full px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-black tracking-tight">Hello, {student?.name.split(' ')[0]}!</h1>
          <p className="text-muted-foreground font-medium">Track your driving journey with {instructor?.first_name} {instructor?.last_name}.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries()} className="font-bold">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {instructor?.logo_url && <img src={instructor.logo_url} alt="Instructor Logo" className="h-12 w-auto object-contain" />}
          <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/5 font-bold" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 mb-8">
          <TabsTrigger value="overview" className="font-bold flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="messages" className="font-bold flex items-center gap-2"><Inbox className="h-4 w-4" /> Messages {combinedMessages.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-primary/10 text-primary border-none">{combinedMessages.length}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-300">
          <StudentBookingStatusCard requests={bookingActivity} onDismiss={handleMarkNotifRead} />

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2"><TrendingUp className="h-3 w-3 text-blue-600" /> Course Progress</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><div className="text-3xl font-black text-blue-700">{progressPercentage}%</div><Badge variant="outline" className="bg-blue-50">{student?.status}</Badge></div>
                <Progress value={progressPercentage} className="h-2" />
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <Button asChild variant="default" className="w-full font-bold bg-blue-600 hover:bg-blue-700"><Link to="/progress-report?tab=self"><Star className="mr-2 h-4 w-4" /> Self Assess Skills</Link></Button>
                  <Button asChild variant="outline" size="sm" className="w-full font-bold"><Link to="/progress-report">View Full Report <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                </div>
              </CardContent>
            </Card>

            <Card className={cn("border-l-4 shadow-sm", totalCredit > 0 ? "border-l-green-500" : "border-l-orange-500")}>
              <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2"><Hourglass className="h-3 w-3 text-primary" /> Lesson Credit</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-primary">{totalCredit.toFixed(1)}h</div><p className="text-[10px] text-muted-foreground mt-1 font-medium">Remaining pre-paid hours</p></CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-purple-600" /> Lessons Done</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-black text-purple-700">{bookings.filter(b => b.status === 'completed').length}</div><p className="text-[10px] text-muted-foreground mt-1 font-medium">Completed sessions</p></CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="shadow-md border-none overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground"><CardTitle className="text-xl font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Next Lesson</CardTitle></CardHeader>
              <CardContent className="p-6">
                {upcomingLesson ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 rounded-xl bg-muted flex flex-col items-center justify-center shrink-0 border shadow-sm"><span className="text-[10px] uppercase font-black text-muted-foreground">{format(parseISO(upcomingLesson.start_time), "MMM")}</span><span className="text-2xl font-black leading-none">{format(parseISO(upcomingLesson.start_time), "dd")}</span></div>
                      <div className="space-y-1"><p className="font-black text-xl">{format(parseISO(upcomingLesson.start_time), "EEEE")}</p><p className="text-muted-foreground font-medium flex items-center gap-2"><Clock className="h-4 w-4" />{format(parseISO(upcomingLesson.start_time), "p")} — {format(parseISO(upcomingLesson.end_time), "p")}</p></div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-muted"><p className="text-xs font-bold uppercase text-muted-foreground mb-1">Lesson Type</p><p className="font-bold">{upcomingLesson.lesson_type}</p>{upcomingLesson.description && <p className="text-sm text-muted-foreground mt-2 italic">"{upcomingLesson.description}"</p>}</div>
                  </div>
                ) : <div className="text-center py-8 text-muted-foreground italic">No upcoming lessons scheduled.</div>}
              </CardContent>
            </Card>

            <Card className="shadow-md border-none overflow-hidden">
              <CardHeader className="bg-blue-600 text-white"><CardTitle className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5" /> Available Extra Lessons</CardTitle></CardHeader>
              <CardContent className="p-0">
                {availableSlots.length === 0 ? <div className="p-12 text-center text-muted-foreground italic">No extra slots available right now.</div> : (
                  <div className="divide-y">
                    {availableSlots.map((slot) => {
                      const start = parseISO(slot.start_time);
                      const duration = differenceInMinutes(parseISO(slot.end_time), start) / 60;
                      return (
                        <div key={slot.id} className="p-4 flex items-center justify-between hover:bg-blue-50 transition-colors">
                          <div className="space-y-1"><p className="font-bold text-sm">{format(start, "EEEE, MMM do")}</p><p className="text-xs text-muted-foreground flex items-center gap-2"><Clock className="h-3 w-3" />{format(start, "p")} ({duration.toFixed(1)}h)</p></div>
                          <Button size="sm" className={cn("font-bold", instructor?.require_booking_approval ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700")} onClick={() => handleBookSlot(slot)} disabled={isBooking === slot.id}>{isBooking === slot.id ? "Booking..." : instructor?.require_booking_approval ? <><ClipboardCheck className="mr-1 h-4 w-4" /> Request</> : <><Plus className="mr-1 h-4 w-4" /> Book</>}</Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-3 bg-muted/10 border-t text-center">
                <Button asChild variant="link" size="sm" className="w-full font-bold text-blue-600">
                  <Link to="/available-slots">View Full Calendar <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="animate-in fade-in duration-300">
          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground"><CardTitle className="text-xl font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Instructor Notes & Feedback</CardTitle><CardDescription className="text-primary-foreground/70">A history of all notes, targets, and direct messages from your instructor.</CardDescription></CardHeader>
            <CardContent className="p-0">
              {combinedMessages.length === 0 ? <div className="p-12 text-center space-y-4"><div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto"><Inbox className="h-8 w-8 text-muted-foreground" /></div><p className="text-muted-foreground font-medium italic">No messages or lesson notes found yet.</p></div> : (
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {combinedMessages.map((item) => (
                      <div key={item.id} className={cn("p-6 space-y-4 hover:bg-muted/30 transition-colors", item.type === 'direct_message' && "bg-primary/5")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {item.type === 'lesson_note' ? (
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/10"><span className="text-[8px] uppercase font-black text-primary">{format(parseISO(item.date), "MMM")}</span><span className="text-lg font-black leading-none text-primary">{format(parseISO(item.date), "dd")}</span></div>
                            ) : <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">{item.is_broadcast ? <Megaphone className="h-5 w-5 text-white" /> : <MessageSquare className="h-5 w-5 text-white" />}</div>}
                            <div><p className="font-black text-sm">{item.title}</p><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.subtitle}</p></div>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase"><Clock className="h-3 w-3" />{format(parseISO(item.date), "p")}</div>
                        </div>
                        <div className="space-y-4 pl-1">
                          {item.content && <div className="space-y-1.5"><p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> {item.type === 'lesson_note' ? 'Lesson Feedback' : 'Message'}</p><div className={cn("p-4 rounded-xl italic text-sm border", item.type === 'direct_message' ? "bg-background border-blue-100" : "bg-muted/50 border-muted")}>"{item.content}"</div></div>}
                          {item.targets && <div className="space-y-1.5"><p className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5"><Target className="h-3 w-3" /> Targets for Next Time</p><div className="bg-primary/5 p-4 rounded-xl font-bold text-sm border border-primary/10 text-primary">{item.targets}</div></div>}
                          {item.type === 'direct_message' && (
                            <div className="pt-2">
                              <Button variant="ghost" size="sm" onClick={() => setExpandedMessageId(expandedMessageId === item.id ? null : item.id)} className="text-[10px] font-bold uppercase h-7 px-2">{expandedMessageId === item.id ? "Hide Conversation" : "View / Reply"}</Button>
                              {expandedMessageId === item.id && <div className="mt-4 animate-in slide-in-from-top-2 duration-200"><MessageConversation messageId={item.id} instructorId={item.instructor_id} studentId={student?.id || null} isBroadcast={item.is_broadcast} /></div>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDashboard;