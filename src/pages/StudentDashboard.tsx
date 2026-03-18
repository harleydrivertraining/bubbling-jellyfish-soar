"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, parseISO, differenceInMinutes, addHours } from "date-fns";
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
  X
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate, Link } from "react-router-dom";

interface StudentData {
  id: string;
  name: string;
  status: string;
  user_id: string; // Instructor ID
}

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  lesson_type: string;
  description?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: string;
}

const StudentDashboard: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [instructor, setInstructor] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availableSlots, setAvailableSlots] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/login";
    }
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Get Student Record
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // 2. Get Instructor Info
      const { data: instructorData } = await supabase
        .from("profiles")
        .select("first_name, last_name, logo_url, min_booking_notice_hours, require_booking_approval")
        .eq("id", studentData.user_id)
        .single();
      setInstructor(instructorData);

      const noticeHours = instructorData?.min_booking_notice_hours ?? 48;

      // 3. Get Bookings
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*")
        .eq("student_id", studentData.id)
        .order("start_time", { ascending: true });
      setBookings(bookingsData || []);

      // 4. Get Available Slots from this instructor
      const minBookingTime = addHours(new Date(), noticeHours).toISOString();
      const { data: availabilityData, error: availError } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", studentData.user_id)
        .eq("status", "available")
        .gte("start_time", minBookingTime)
        .order("start_time", { ascending: true });
      
      if (availError) console.error("Error fetching availability:", availError);
      setAvailableSlots(availabilityData || []);

      // 5. Get Pre-paid Hours
      const { data: hoursData } = await supabase
        .from("pre_paid_hours")
        .select("remaining_hours")
        .eq("student_id", studentData.id);
      
      const total = hoursData?.reduce((sum, pkg) => sum + (pkg.remaining_hours || 0), 0) || 0;
      setTotalCredit(total);

      // 6. Get Notifications
      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);
      setNotifications(notifData || []);

      // 7. Calculate Progress
      const [topicsRes, hiddenRes, entriesRes] = await Promise.all([
        supabase.from("progress_topics").select("id").or(`user_id.eq.${studentData.user_id},is_default.eq.true`),
        supabase.from("hidden_progress_topics").select("topic_id").eq("user_id", studentData.user_id),
        supabase.from("student_progress_entries").select("topic_id, rating").eq("student_id", studentData.id).order("entry_date", { ascending: false })
      ]);

      const hiddenIds = new Set((hiddenRes.data || []).map(h => h.topic_id));
      const visibleTopicsCount = (topicsRes.data || []).filter(t => !hiddenIds.has(t.id)).length;

      if (visibleTopicsCount > 0) {
        const latestRatings: Record<string, number> = {};
        entriesRes.data?.forEach(entry => {
          if (!latestRatings[entry.topic_id]) latestRatings[entry.topic_id] = entry.rating;
        });
        const totalStars = Object.values(latestRatings).reduce((sum, r) => sum + r, 0);
        setProgressPercentage(Math.round((totalStars / (visibleTopicsCount * 5)) * 100));
      }

    } catch (error: any) {
      console.error("Error fetching student dashboard:", error);
      showError("Failed to load your dashboard.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchData();
  }, [isSessionLoading, fetchData]);

  const handleMarkNotifRead = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const handleBookSlot = async (slot: Booking) => {
    if (!student || !instructor) return;
    
    setIsBooking(slot.id);
    try {
      const requireApproval = instructor.require_booking_approval ?? false;
      const newStatus = requireApproval ? "pending_approval" : "scheduled";
      const displayTitle = requireApproval 
        ? `${student.name} - Pending Approval` 
        : `${student.name} - Driving lesson`;

      const { error } = await supabase
        .from("bookings")
        .update({
          student_id: student.id,
          status: newStatus,
          title: displayTitle,
          lesson_type: "Driving lesson"
        })
        .eq("id", slot.id);

      if (error) throw error;

      // Create in-app notification for instructor
      await supabase.from("notifications").insert({
        user_id: student.user_id,
        title: requireApproval ? "New Booking Request!" : "New Lesson Booked!",
        message: `${student.name} has ${requireApproval ? 'requested' : 'booked'} the available slot on ${format(parseISO(slot.start_time), "PPP p")}.`,
        type: "booking_claimed"
      });

      showSuccess(requireApproval ? "Request sent! Waiting for instructor approval." : "Lesson booked successfully!");
      fetchData(true);
    } catch (error: any) {
      showError("Failed to book lesson: " + error.message);
    } finally {
      setIsBooking(null);
    }
  };

  const upcomingLesson = useMemo(() => {
    return bookings.find(b => b.status === 'scheduled' && isAfter(parseISO(b.start_time), new Date()));
  }, [bookings]);

  const pendingRequests = useMemo(() => {
    return bookings.filter(b => b.status === 'pending_approval' && isAfter(parseISO(b.start_time), new Date()));
  }, [bookings]);

  if (isSessionLoading || isLoading) {
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
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={isRefreshing} className="font-bold">
            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          {instructor?.logo_url && (
            <img src={instructor.logo_url} alt="Instructor Logo" className="h-12 w-auto object-contain" />
          )}
          <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/5 font-bold" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      {/* Notifications / Alerts Section */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" /> Recent Alerts
          </h3>
          <div className="grid gap-3">
            {notifications.map((notif) => (
              <Card key={notif.id} className={cn(
                "border-l-4 shadow-sm",
                notif.type === 'booking_rejected' ? "border-l-red-500 bg-red-50/30" : "border-l-blue-500 bg-blue-50/30"
              )}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {notif.type === 'booking_rejected' ? (
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    ) : (
                      <Bell className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className={cn("font-bold text-sm", notif.type === 'booking_rejected' ? "text-red-900" : "text-blue-900")}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleMarkNotifRead(notif.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <Card className="border-l-4 border-l-orange-500 bg-orange-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-orange-800">
              <ClipboardCheck className="h-5 w-5 text-orange-600" />
              Pending Approval ({pendingRequests.length})
            </CardTitle>
            <CardDescription className="text-orange-700/70">
              Your instructor needs to confirm these lesson requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-orange-100">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-orange-900">{format(parseISO(req.start_time), "EEEE, MMM do")}</p>
                    <p className="text-xs text-orange-800/70 flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(req.start_time), "p")}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-white text-orange-600 border-orange-200 font-bold uppercase text-[10px]">
                    Waiting...
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-blue-600" /> Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-3xl font-black text-blue-700">{progressPercentage}%</div>
              <Badge variant="outline" className="bg-blue-50">{student?.status}</Badge>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            
            <div className="grid grid-cols-1 gap-2 pt-2">
              <Button asChild variant="default" className="w-full font-bold bg-blue-600 hover:bg-blue-700">
                <Link to="/progress-report?tab=self">
                  <Star className="mr-2 h-4 w-4" /> Self Assess Skills
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full font-bold">
                <Link to="/progress-report">View Full Report <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4 shadow-sm", totalCredit > 0 ? "border-l-green-500" : "border-l-orange-500")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Hourglass className="h-3 w-3 text-primary" /> Lesson Credit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{totalCredit.toFixed(1)}h</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Remaining pre-paid hours</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-purple-600" /> Lessons Done
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-purple-700">
              {bookings.filter(b => b.status === 'completed').length}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Completed sessions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Next Lesson
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {upcomingLesson ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-xl bg-muted flex flex-col items-center justify-center shrink-0 border shadow-sm">
                    <span className="text-[10px] uppercase font-black text-muted-foreground">{format(parseISO(upcomingLesson.start_time), "MMM")}</span>
                    <span className="text-2xl font-black leading-none">{format(parseISO(upcomingLesson.start_time), "dd")}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-xl">{format(parseISO(upcomingLesson.start_time), "EEEE")}</p>
                    <p className="text-muted-foreground font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(parseISO(upcomingLesson.start_time), "p")} — {format(parseISO(upcomingLesson.end_time), "p")}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border border-muted">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Lesson Type</p>
                  <p className="font-bold">{upcomingLesson.lesson_type}</p>
                  {upcomingLesson.description && (
                    <p className="text-sm text-muted-foreground mt-2 italic">"{upcomingLesson.description}"</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground italic">
                No upcoming lessons scheduled.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-blue-600 text-white">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Available Extra Lessons
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {availableSlots.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic">
                No extra slots available right now.
              </div>
            ) : (
              <div className="divide-y">
                {availableSlots.map((slot) => {
                  const start = parseISO(slot.start_time);
                  const duration = differenceInMinutes(parseISO(slot.end_time), start) / 60;
                  
                  return (
                    <div key={slot.id} className="p-4 flex items-center justify-between hover:bg-blue-50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-bold text-sm">{format(start, "EEEE, MMM do")}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {format(start, "p")} ({duration.toFixed(1)}h)
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        className={cn("font-bold", instructor?.require_booking_approval ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700")}
                        onClick={() => handleBookSlot(slot)}
                        disabled={isBooking === slot.id}
                      >
                        {isBooking === slot.id ? "Booking..." : instructor?.require_booking_approval ? <><ClipboardCheck className="mr-1 h-4 w-4" /> Request</> : <><Plus className="mr-1 h-4 w-4" /> Book</>}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Recent Feedback
          </CardTitle>
          <CardDescription>Notes from your last session.</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.filter(b => b.status === 'completed' && b.description).length > 0 ? (
            <div className="space-y-4">
              {bookings
                .filter(b => b.status === 'completed' && b.description)
                .slice(0, 1)
                .map(b => (
                  <div key={b.id} className="space-y-3">
                    <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-l-primary italic text-sm">
                      "{b.description}"
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      Recorded on {format(parseISO(b.start_time), "MMM d, yyyy")}
                    </p>
                  </div>
                ))
              }
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground italic">
              No feedback recorded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard;