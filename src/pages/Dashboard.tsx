"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { format, isAfter, startOfMonth, endOfMonth, subYears, differenceInMinutes, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isToday, differenceInDays } from "date-fns";
import { 
  Users, 
  CalendarDays, 
  PoundSterling, 
  Car, 
  Hourglass, 
  BookOpen, 
  Clock, 
  ArrowRight, 
  Gauge, 
  TrendingUp, 
  ShieldAlert, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Settings2, 
  GraduationCap, 
  Shield, 
  ClipboardCheck, 
  Check, 
  X, 
  RefreshCw,
  Hand,
  Zap,
  Infinity,
  ListTodo,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardCustomizer, { DashboardWidget } from "@/components/DashboardCustomizer";
import OwnerDashboard from "./OwnerDashboard";
import StudentDashboard from "./StudentDashboard";
import DashboardTodoWidget from "@/components/DashboardTodoWidget";
import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: string;
  lesson_type: string;
  student_id?: string;
  students: {
    name: string;
  };
}

type RevenueTimeframe = "daily" | "weekly" | "monthly";

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "pending_requests", label: "Booking Requests", visible: true },
  { id: "quick_stats", label: "Quick Stats Row", visible: true },
  { id: "todo_list", label: "To Do List", visible: true },
  { id: "upcoming_lessons", label: "Upcoming Lessons List", visible: true },
  { id: "test_stats", label: "Test Performance (12m)", visible: true },
  { id: "next_tests", label: "Next Driving Tests", visible: true },
  { id: "service_info", label: "Vehicle Service", visible: true },
  { id: "pending_income", label: "Pending Income", visible: true },
  { id: "prepaid_info", label: "Pre-Paid Hours", visible: true },
];

const Dashboard: React.FC = () => {
  const { user, isLoading: isSessionLoading, subscriptionStatus, userRole } = useSession();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const [revenueTimeframe, setRevenueTimeframe] = useState<RevenueTimeframe>("weekly");
  const [selectedWeekStartISO, setSelectedWeekStartISO] = useState<string>(startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString());
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);

  useEffect(() => {
    const savedWidgets = localStorage.getItem("dashboard_widgets");
    if (savedWidgets) {
      try {
        const parsed = JSON.parse(savedWidgets);
        const merged = DEFAULT_WIDGETS.map(def => {
          const saved = parsed.find((p: DashboardWidget) => p.id === def.id);
          return saved ? saved : def;
        });
        setWidgets(merged);
      } catch (e) {
        console.error("Failed to parse saved widgets", e);
      }
    }
  }, []);

  const { data: instructorSettings } = useQuery({
    queryKey: ['instructor-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === 'instructor',
    staleTime: 1000 * 60 * 5,
  });

  const isInstructor = userRole === 'instructor';

  const { data: pendingRequests } = useQuery({
    queryKey: ['pending-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("bookings")
        .select("id, title, start_time, end_time, student_id, students(name, auth_user_id)")
        .eq("user_id", user!.id)
        .eq("status", "pending_approval")
        .order("start_time", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!user && isInstructor,
  });

  const { data: studentsCount } = useQuery({
    queryKey: ['students-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_past_student", false);
      return count || 0;
    },
    enabled: !!user && isInstructor,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['dashboard-bookings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, title, description, start_time, end_time, status, lesson_type, students(name)")
        .eq("user_id", user!.id)
        .eq("status", "scheduled")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true });
      return (data || []) as unknown as Booking[];
    },
    enabled: !!user && isInstructor,
  });

  const calculateLessonValue = useCallback((durationHours: number, profile: any) => {
    if (!profile) return 0;
    if (durationHours === 1 && profile.rate_1h) return profile.rate_1h;
    if (durationHours === 1.5 && profile.rate_1_5h) return profile.rate_1_5h;
    if (durationHours === 2 && profile.rate_2h) return profile.rate_2h;
    return durationHours * (profile.hourly_rate || 0);
  }, []);

  const { data: revenue } = useQuery({
    queryKey: ['revenue', user?.id, revenueTimeframe, instructorSettings],
    queryFn: async () => {
      const now = new Date();
      let startDate: Date, endDate: Date;
      if (revenueTimeframe === "daily") { startDate = startOfDay(now); endDate = endOfDay(now); }
      else if (revenueTimeframe === "weekly") { startDate = startOfWeek(now, { weekStartsOn: 1 }); endDate = endOfWeek(now, { weekStartsOn: 1 }); }
      else { startDate = startOfMonth(now); endDate = endOfMonth(now); }

      const { data } = await supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("user_id", user!.id)
        .eq("status", "completed")
        .neq("lesson_type", "Personal")
        .gte("start_time", startDate.toISOString())
        .lte("end_time", endDate.toISOString());
        
      let totalValue = 0;
      data?.forEach(b => {
        const duration = differenceInMinutes(new Date(b.end_time), new Date(b.start_time)) / 60;
        totalValue += calculateLessonValue(duration, instructorSettings);
      });
      return totalValue;
    },
    enabled: !!user && isInstructor && !!instructorSettings,
  });

  const { data: pendingIncome } = useQuery({
    queryKey: ['pending-income-dashboard', user?.id, instructorSettings],
    queryFn: async () => {
      const [lessonsRes, creditTxRes] = await Promise.all([
        supabase.from("bookings").select("id, start_time, end_time, is_paid").eq("user_id", user!.id).eq("status", "completed").eq("is_paid", false).neq("lesson_type", "Personal"),
        supabase.from("pre_paid_hours_transactions").select("booking_id").eq("user_id", user!.id)
      ]);

      const creditPaidIds = new Set(creditTxRes.data?.map(t => t.booking_id));
      let total = 0;
      
      lessonsRes.data?.forEach(lesson => {
        if (!creditPaidIds.has(lesson.id)) {
          const duration = differenceInMinutes(new Date(lesson.end_time), new Date(lesson.start_time)) / 60;
          total += calculateLessonValue(duration, instructorSettings);
        }
      });
      
      return total;
    },
    enabled: !!user && isInstructor && !!instructorSettings,
  });

  const { data: bookedHours } = useQuery({
    queryKey: ['booked-hours', user?.id, selectedWeekStartISO],
    queryFn: async () => {
      const weekStartDate = parseISO(selectedWeekStartISO);
      const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

      const { data } = await supabase
        .from("bookings")
        .select("start_time, end_time")
        .eq("user_id", user!.id)
        .in("status", ["scheduled", "completed"])
        .neq("lesson_type", "Personal")
        .gte("start_time", weekStartDate.toISOString())
        .lte("end_time", weekEndDate.toISOString());

      let totalMinutes = 0;
      data?.forEach(booking => {
        totalMinutes += differenceInMinutes(new Date(booking.end_time), new Date(booking.start_time));
      });
      return totalMinutes / 60;
    },
    enabled: !!user && isInstructor,
  });

  const { data: testStats } = useQuery({
    queryKey: ['test-stats-dashboard', user?.id],
    queryFn: async () => {
      const twelveMonthsAgo = subYears(new Date(), 1);
      const { data } = await supabase
        .from("driving_tests")
        .select("passed, driving_faults, serious_faults, examiner_action")
        .eq("user_id", user!.id)
        .gte("test_date", twelveMonthsAgo.toISOString());

      if (!data || data.length === 0) return null;

      const total = data.length;
      return {
        totalTests: total,
        passRate: (data.filter(t => t.passed).length / total) * 100,
        avgDrivingFaults: data.reduce((sum, t) => sum + t.driving_faults, 0) / total,
        avgSeriousFaults: data.reduce((sum, t) => sum + t.serious_faults, 0) / total,
        examinerActionPercentage: (data.filter(t => t.examiner_action).length / total) * 100,
      };
    },
    enabled: !!user && isInstructor,
  });

  const { data: serviceInfo } = useQuery({
    queryKey: ['service-info', user?.id],
    queryFn: async () => {
      const { data: cars } = await supabase
        .from("cars")
        .select("id, make, model, year, initial_mileage, service_interval_miles, acquisition_date")
        .eq("user_id", user!.id);

      if (!cars || cars.length === 0) return null;

      const { data: allMileage } = await supabase
        .from("car_mileage_entries")
        .select("car_id, current_mileage, entry_date")
        .eq("user_id", user!.id)
        .order("entry_date", { ascending: false });

      let minMiles: number | null = null;
      let carName: string | null = null;
      let predictedWeeks: number | null = null;

      cars.forEach(car => {
        if (car.service_interval_miles && car.service_interval_miles > 0) {
          const latestEntry = allMileage?.find(m => m.car_id === car.id);
          const currentMileage = latestEntry?.current_mileage || car.initial_mileage;
          const milesUntil = ((Math.floor(currentMileage / car.service_interval_miles) + 1) * car.service_interval_miles) - currentMileage;
          
          const acquisitionDate = parseISO(car.acquisition_date);
          const daysTracked = differenceInDays(new Date(), acquisitionDate);
          const totalMilesDriven = currentMileage - car.initial_mileage;

          if (minMiles === null || milesUntil < minMiles) {
            minMiles = milesUntil;
            carName = `${car.make} ${car.model}`;
            if (daysTracked > 0 && totalMilesDriven > 0) {
              predictedWeeks = milesUntil / ((totalMilesDriven / daysTracked) * 7);
            }
          }
        }
      });

      return { minMiles, carName, predictedWeeks };
    },
    enabled: !!user && isInstructor,
  });

  const { data: prePaidInfo } = useQuery({
    queryKey: ['prepaid-info', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pre_paid_hours")
        .select("remaining_hours, students(name)")
        .eq("user_id", user!.id);

      if (!data) return null;

      let total = 0;
      const studentMap: Record<string, number> = {};
      data.forEach(pkg => {
        total += pkg.remaining_hours;
        const name = pkg.students?.name || "Unknown";
        studentMap[name] = (studentMap[name] || 0) + pkg.remaining_hours;
      });

      return {
        total,
        lowBalanceStudents: Object.keys(studentMap).filter(name => studentMap[name] <= 2 && studentMap[name] > 0)
      };
    },
    enabled: !!user && isInstructor,
  });

  const handleApprove = async (id: string, studentName: string, authUserId: string | null) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "scheduled", title: `${studentName} - Driving lesson` })
      .eq("id", id);
    
    if (error) showError("Failed to approve.");
    else {
      if (authUserId) {
        const req = pendingRequests?.find(r => r.id === id);
        await supabase.from("notifications").insert({
          user_id: authUserId,
          title: "Booking Approved!",
          message: `Your lesson on ${format(parseISO(req.start_time), "PPP")} has been confirmed.`,
          type: "booking_confirmed"
        });
      }
      showSuccess("Booking approved!");
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-bookings'] });
    }
  };

  const handleReject = async (id: string, authUserId: string | null, startTime: string) => {
    if (authUserId && startTime) {
      await supabase.from("notifications").insert({
        user_id: authUserId,
        title: "Booking Request Declined",
        message: `Your request for the slot on ${format(parseISO(startTime), "PPP")} was not approved.`,
        type: "booking_rejected"
      });
    }
    const { error } = await supabase
      .from("bookings")
      .update({ status: "available", student_id: null, title: "Available Slot" })
      .eq("id", id);
    
    if (error) showError("Failed to reject.");
    else {
      showSuccess("Booking rejected.");
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    showSuccess("Refreshing dashboard data...");
  };

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const generateWeekOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 4; i >= 1; i--) {
      const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      options.push({ label: `${format(start, "MMM dd")} - ${format(endOfWeek(start, { weekStartsOn: 1 }), "MMM dd")}`, value: start.toISOString() });
    }
    const currentStart = startOfWeek(now, { weekStartsOn: 1 });
    options.push({ label: "Current Week", value: currentStart.toISOString() });
    for (let i = 1; i <= 4; i++) {
      const start = startOfWeek(addWeeks(now, i), { weekStartsOn: 1 });
      options.push({ label: `${format(start, "MMM dd")} - ${format(endOfWeek(start, { weekStartsOn: 1 }), "MMM dd")}`, value: start.toISOString() });
    }
    return options;
  }, []);

  const renderWidget = (id: string) => {
    switch (id) {
      case "pending_requests": {
        const hasRequests = pendingRequests && pendingRequests.length > 0;
        if (!hasRequests) return null;
        return (
          <Card key={id} className="shadow-md overflow-hidden transition-all border-l-4 border-l-orange-500 bg-orange-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-orange-800">
                <ClipboardCheck className="h-5 w-5 text-orange-600" />
                Booking Requests ({pendingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-orange-100">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-orange-100/50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-bold text-orange-900">{req.students?.name || "Unknown Student"}</p>
                      <div className="flex items-center gap-3 text-xs text-orange-800/70 mt-1 font-medium">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(parseISO(req.start_time), "EEE, MMM do")}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(parseISO(req.start_time), "p")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 font-bold h-8" onClick={() => handleApprove(req.id, req.students?.name, req.students?.auth_user_id)}><Check className="mr-1 h-4 w-4" /> Approve</Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 font-bold h-8" onClick={() => handleReject(req.id, req.students?.auth_user_id, req.start_time)}><X className="mr-1 h-4 w-4" /> Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      }
      case "quick_stats":
        return (
          <div key={id} className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3">
                <CardTitle className="text-sm sm:text-lg font-bold text-muted-foreground">Total Students</CardTitle>
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-3xl sm:text-4xl font-black">{studentsCount ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3">
                <CardTitle className="text-sm sm:text-lg font-bold text-muted-foreground">Upcoming Tests</CardTitle>
                <Car className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-3xl sm:text-4xl font-black">{(bookingsData || []).filter(b => b.lesson_type === "Driving Test").length}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardHeader className="flex flex-col items-start space-y-2 pb-1 p-3">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="text-sm sm:text-lg font-bold text-muted-foreground">Booked Hours</CardTitle>
                  <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                </div>
                <Select onValueChange={setSelectedWeekStartISO} defaultValue={selectedWeekStartISO}>
                  <SelectTrigger className="w-full h-8 sm:h-10 text-xs sm:text-sm px-2"><SelectValue placeholder="Select Week" /></SelectTrigger>
                  <SelectContent>{generateWeekOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs sm:text-sm">{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-3xl sm:text-4xl font-black">{(bookedHours ?? 0).toFixed(1)} <span className="text-xs sm:text-sm font-bold text-muted-foreground uppercase">hrs</span></div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="flex flex-col items-start space-y-2 pb-1 p-3">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="text-sm sm:text-lg font-bold text-muted-foreground">Income</CardTitle>
                  <PoundSterling className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <Select onValueChange={(value: RevenueTimeframe) => setRevenueTimeframe(value)} defaultValue={revenueTimeframe}>
                  <SelectTrigger className="w-full h-8 text-xs sm:text-sm px-2"><SelectValue placeholder="Timeframe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily" className="text-xs sm:text-sm">Today</SelectItem>
                    <SelectItem value="weekly" className="text-xs sm:text-sm">This Week</SelectItem>
                    <SelectItem value="monthly" className="text-xs sm:text-sm">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {instructorSettings?.hourly_rate ? (
                  <div className="text-3xl sm:text-4xl font-black">£{(revenue ?? 0).toFixed(2)}</div>
                ) : (
                  <div className="text-[10px] sm:text-sm text-muted-foreground">Set <Link to="/settings" className="text-blue-500 hover:underline">rate</Link></div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      case "todo_list":
        return <DashboardTodoWidget key={id} />;
      case "upcoming_lessons": {
        const upcoming = bookingsData || [];
        const displayed = showAllLessons ? upcoming : upcoming.slice(0, 3);
        return (
          <Card key={id} className="flex flex-col overflow-hidden shadow-md border-none h-full">
            <CardHeader className="bg-primary text-primary-foreground p-4">
              <div className="flex flex-col gap-3">
                <CardTitle className="text-xl font-bold">Upcoming Lessons</CardTitle>
                <Button asChild variant="secondary" size="sm" className="w-full h-9"><Link to="/schedule" className="flex items-center justify-center">Full Schedule <Calendar className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 bg-card">
              {upcoming.length === 0 ? (
                <div className="p-12 text-center"><Calendar className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" /><p className="text-muted-foreground font-medium">No upcoming lessons.</p></div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="divide-y divide-muted">
                    {displayed.map((booking) => {
                      const startTime = new Date(booking.start_time);
                      const isLessonToday = isToday(startTime);
                      return (
                        <div key={booking.id} className={cn("p-5 transition-all hover:bg-muted/30 flex items-start gap-5", isLessonToday && "bg-primary/5 border-l-4 border-l-primary")}>
                          <div className="flex flex-col items-center justify-center min-w-[64px] py-2 rounded-xl bg-muted border shadow-sm">
                            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">{format(startTime, "MMM")}</span>
                            <span className="text-2xl font-black leading-none">{format(startTime, "dd")}</span>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-lg truncate text-foreground">{booking.students?.name || "Unknown Student"}</h4>
                              {isLessonToday && <Badge variant="default" className="bg-blue-600 text-[10px] font-bold h-5 px-2 shrink-0">TODAY</Badge>}
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground"><Clock className="mr-2 h-4 w-4 text-primary/60 shrink-0" /><span className="font-medium">{format(startTime, "p")} - {format(new Date(booking.end_time), "p")}</span></div>
                            <div className="flex items-center text-sm text-muted-foreground"><BookOpen className="mr-2 h-4 w-4 text-primary/60 shrink-0" /><span className="capitalize font-medium">{booking.lesson_type}</span></div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors shrink-0" asChild><Link to="/schedule"><ArrowRight className="h-5 w-5" /></Link></Button>
                        </div>
                      );
                    })}
                  </div>
                  {upcoming.length > 3 && (
                    <div className="p-4 text-center border-t bg-muted/5">
                      <Button variant="ghost" size="sm" onClick={() => setShowAllLessons(!showAllLessons)} className="text-primary font-bold w-full py-6">{showAllLessons ? <>Show Less <ChevronUp className="ml-2 h-4 w-4" /></> : <>View More ({upcoming.length - 3} more) <ChevronDown className="ml-2 h-4 w-4" /></>}</Button>
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        );
      }
      case "test_stats":
        return (
          <Card key={id} className="p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
              <div><CardTitle className="text-lg font-bold">Test Performance</CardTitle><CardDescription className="text-sm">Last 12 months</CardDescription></div>
              <Button asChild variant="ghost" size="sm" className="text-primary font-semibold"><Link to="/test-statistics">Full Stats <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
            {testStats ? (
              <div className="grid gap-3 grid-cols-2">
                <div className={cn("p-4 rounded-xl border flex flex-col items-center justify-center space-y-1", testStats.passRate <= 55 ? "bg-orange-50 text-orange-900" : "bg-green-50 text-green-900")}><TrendingUp className="h-5 w-5 opacity-60" /><p className="text-xs font-bold uppercase tracking-wider opacity-70">Pass Rate</p><p className="text-2xl font-black">{testStats.passRate.toFixed(1)}%</p></div>
                <div className={cn("p-4 rounded-xl border flex flex-col items-center justify-center space-y-1", testStats.avgDrivingFaults >= 6 ? "bg-orange-50 text-orange-900" : "bg-green-50 text-green-900")}><Car className="h-5 w-5 opacity-60" /><p className="text-xs font-bold uppercase tracking-wider opacity-70">Avg D.F.</p><p className="text-2xl font-black">{testStats.avgDrivingFaults.toFixed(1)}</p></div>
                <div className={cn("p-4 rounded-xl border flex flex-col items-center justify-center space-y-1", testStats.avgSeriousFaults >= 0.55 ? "bg-orange-50 text-orange-900" : "bg-green-50 text-green-900")}><ShieldAlert className="h-5 w-5 opacity-60" /><p className="text-xs font-bold uppercase tracking-wider opacity-70">Avg S.F.</p><p className="text-2xl font-black">{testStats.avgSeriousFaults.toFixed(1)}</p></div>
                <div className={cn("p-4 rounded-xl border flex flex-col items-center justify-center space-y-1", testStats.examinerActionPercentage >= 10 ? "bg-orange-50 text-orange-900" : "bg-green-50 text-green-900")}><Hand className="h-5 w-5 opacity-60" /><p className="text-xs font-bold uppercase tracking-wider opacity-70">Ex. Act.</p><p className="text-2xl font-black">{testStats.examinerActionPercentage.toFixed(1)}%</p></div>
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">No test data available.</p>}
          </Card>
        );
      case "next_tests": {
        const nextTests = (bookingsData || []).filter(b => b.lesson_type === "Driving Test").slice(0, 2);
        return (
          <Card key={id} className="p-6 shadow-sm h-full">
            <CardTitle className="text-lg font-bold mb-4 flex items-center"><GraduationCap className="mr-2 h-5 w-5 text-primary" />Next Driving Tests</CardTitle>
            {nextTests.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No upcoming tests.</p>
            ) : (
              <div className="space-y-3">
                {nextTests.map((booking) => (
                  <div key={booking.id} className="p-3 rounded-lg bg-muted/40 border border-muted flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{booking.students?.name || "Unknown Student"}</p>
                      <div className="flex items-center text-[10px] text-muted-foreground mt-1"><CalendarDays className="mr-1 h-3 w-3" /><span>{format(new Date(booking.start_time), "MMM dd")} at {format(new Date(booking.start_time), "p")}</span></div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link to="/driving-test-bookings"><ArrowRight className="h-4 w-4" /></Link></Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      }
      case "service_info": {
        const isServiceWarning = !!serviceInfo && serviceInfo.minMiles !== null && serviceInfo.minMiles < 1000;
        return (
          <Card key={id} className={cn("shadow-sm h-full", isServiceWarning ? "bg-orange-50 border-orange-200" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Vehicle Service</CardTitle>
              <Gauge className={cn("h-4 w-4", isServiceWarning ? "text-orange-600" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              {serviceInfo ? (
                <>
                  <div className="text-2xl font-black">{serviceInfo.minMiles?.toFixed(0)} <span className="text-xs font-bold text-muted-foreground uppercase">miles</span></div>
                  {serviceInfo.carName && <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tight">{serviceInfo.carName}</p>}
                  {serviceInfo.predictedWeeks !== null && <p className="text-xs font-bold text-primary mt-2">Due in approx. <span className="text-lg">{Math.ceil(serviceInfo.predictedWeeks)}</span> weeks</p>}
                </>
              ) : <p className="text-xs text-muted-foreground">No car data.</p>}
            </CardContent>
          </Card>
        );
      }
      case "pending_income": {
        const hasPending = (pendingIncome ?? 0) > 0;
        return (
          <Card key={id} className={cn("shadow-sm h-full", hasPending ? "bg-red-50 border-red-200" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Pending Income</CardTitle>
              <Wallet className={cn("h-4 w-4", hasPending ? "text-red-600" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-black", hasPending ? "text-red-700" : "")}>£{(pendingIncome ?? 0).toFixed(2)}</div>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tight">Unpaid completed lessons</p>
              {hasPending && (
                <Button asChild variant="link" size="sm" className="p-0 h-auto text-[10px] font-bold text-red-600 mt-2">
                  <Link to="/accounts">View Details <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      }
      case "prepaid_info": {
        const isPrepaidWarning = !!prePaidInfo && prePaidInfo.total !== null && prePaidInfo.total <= 2;
        return (
          <Card key={id} className={cn("shadow-sm h-full", isPrepaidWarning ? "bg-red-50 border-red-200" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Pre-Paid Hours</CardTitle>
              <Hourglass className={cn("h-4 w-4", isPrepaidWarning ? "text-red-600" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              {prePaidInfo ? (
                <>
                  <div className="text-2xl font-black">{prePaidInfo.total.toFixed(1)} <span className="text-xs font-bold text-muted-foreground uppercase">hrs</span></div>
                  {prePaidInfo.lowBalanceStudents.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-bold text-red-700 uppercase">Low Balance:</p>
                      <p className="text-[10px] text-red-600 truncate">{prePaidInfo.lowBalanceStudents.join(", ")}</p>
                    </div>
                  )}
                </>
              ) : <p className="text-xs text-muted-foreground">No pre-paid data.</p>}
            </CardContent>
          </Card>
        );
      }
      default:
        return null;
    }
  };

  if (isSessionLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  if (userRole === 'owner') return <OwnerDashboard />;
  if (userRole === 'student') return <StudentDashboard />;

  return (
    <div className="space-y-8 w-full px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground">{getGreeting()}, {instructorSettings?.first_name || "Instructor"}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {instructorSettings?.instructor_pin && (
              <div className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/5 px-3 py-1 rounded-full w-fit border border-primary/10">
                <Shield className="h-3.5 w-3.5" />
                <span>Student PIN: <span className="font-mono tracking-widest">{instructorSettings.instructor_pin}</span></span>
              </div>
            )}
            {subscriptionStatus === 'lifetime' ? (
              <Badge className="bg-blue-600 hover:bg-blue-700 font-bold px-3 py-1 rounded-full"><Infinity className="h-3.5 w-3.5 mr-1.5" /> Lifetime</Badge>
            ) : subscriptionStatus === 'unsubscribed' ? (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 font-bold px-3 py-1 rounded-full"><Clock className="h-3.5 w-3.5 mr-1.5" /> Unsubscribed</Badge>
            ) : subscriptionStatus === 'active' ? (
              <Badge className="bg-green-600 hover:bg-green-700 font-bold px-3 py-1 rounded-full"><Zap className="h-3.5 w-3.5 mr-1.5" /> Pro</Badge>
            ) : null}
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-8 w-8 rounded-full hover:bg-primary/10" title="Refresh Data">
              <RefreshCw className={cn("h-4 w-4", isFetching > 0 && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {widgets.filter(w => w.visible).map((widget) => {
          if (widget.id === "pending_requests" && (!pendingRequests || pendingRequests.length === 0)) return null;
          return (
            <div key={widget.id} className={cn(
              widget.id === "quick_stats" && "lg:col-span-3",
              widget.id === "pending_requests" && "lg:col-span-3",
              widget.id === "upcoming_lessons" && "lg:col-span-1 lg:row-span-2",
              (widget.id !== "quick_stats" && widget.id !== "upcoming_lessons" && widget.id !== "pending_requests") && "lg:col-span-1"
            )}>
              {renderWidget(widget.id)}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-8 border-t">
        <Button variant="outline" size="sm" onClick={() => setIsCustomizerOpen(true)} className="shadow-sm font-bold"><Settings2 className="mr-2 h-4 w-4" /> Customise Dashboard</Button>
      </div>

      <DashboardCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        widgets={widgets}
        onUpdateWidgets={(newWidgets) => { setWidgets(newWidgets); localStorage.setItem("dashboard_widgets", JSON.stringify(newWidgets)); }}
        onReset={() => { setWidgets(DEFAULT_WIDGETS); localStorage.removeItem("dashboard_widgets"); }}
      />
    </div>
  );
};

export default Dashboard;