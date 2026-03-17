"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, startOfMonth, endOfMonth, subYears, differenceInMinutes, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isToday, differenceInDays } from "date-fns";
import { Users, CalendarDays, PoundSterling, Car, Hourglass, CheckCircle, XCircle, AlertTriangle, Hand, BookOpen, Clock, ArrowRight, Gauge, TrendingUp, ShieldAlert, Calendar, ChevronDown, ChevronUp, Settings2, GraduationCap } from "lucide-react";
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
import DashboardCustomizer, { DashboardWidget } from "@/components/DashboardCustomizer";
import OwnerDashboard from "./OwnerDashboard";

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: string;
  lesson_type: string;
  students: {
    name: string;
  };
}

interface DrivingTestStats {
  totalTests: number;
  passRate: number;
  avgDrivingFaults: number;
  avgSeriousFaults: number;
  examinerActionPercentage: number;
}

type RevenueTimeframe = "daily" | "weekly" | "monthly";

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "quick_stats", label: "Quick Stats Row", visible: true },
  { id: "upcoming_lessons", label: "Upcoming Lessons List", visible: true },
  { id: "test_stats", label: "Test Performance (12m)", visible: true },
  { id: "next_tests", label: "Next Driving Tests", visible: true },
  { id: "service_info", label: "Vehicle Service", visible: true },
  { id: "prepaid_info", label: "Pre-Paid Hours", visible: true },
];

const Dashboard: React.FC = () => {
  const { user, isLoading: isSessionLoading, profile } = useSession();
  const [instructorName, setInstructorName] = useState<string | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [currentRevenue, setCurrentRevenue] = useState<number | null>(null);
  const [upcomingDrivingTestBookingsCount, setUpcomingDrivingTestBookingsCount] = useState<number | null>(null);
  const [drivingTestStats, setDrivingTestStats] = useState<DrivingTestStats | null>(null);
  const [upcomingLessons, setUpcomingLessons] = useState<Booking[]>([]);
  const [nextDrivingTestBookings, setNextDrivingTestBookings] = useState<Booking[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [revenueTimeframe, setRevenueTimeframe] = useState<RevenueTimeframe>("weekly");
  const [milesUntilNextServiceDashboard, setMilesUntilNextServiceDashboard] = useState<number | null>(null);
  const [weeksUntilNextService, setWeeksUntilNextService] = useState<number | null>(null);
  const [carNeedingService, setCarNeedingService] = useState<string | null>(null);
  const [totalPrePaidHoursRemaining, setTotalPrePaidHoursRemaining] = useState<number | null>(null);
  const [studentsWithLowPrePaidHours, setStudentsWithLowPrePaidHours] = useState<string[]>([]);

  const [totalBookedHoursForSelectedWeek, setTotalBookedHoursForSelectedWeek] = useState<number | null>(null);
  const [selectedWeekStartISO, setSelectedWeekStartISO] = useState<string>(startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString());
  
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);

  useEffect(() => {
    const savedWidgets = localStorage.getItem("dashboard_widgets");
    if (savedWidgets) {
      try {
        const parsed = JSON.parse(savedWidgets);
        setWidgets(parsed);
      } catch (e) {
        console.error("Failed to parse saved widgets", e);
      }
    }
  }, []);

  const saveWidgets = (newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);
    localStorage.setItem("dashboard_widgets", JSON.stringify(newWidgets));
  };

  const resetWidgets = () => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem("dashboard_widgets");
  };

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const fetchBookedHoursForWeek = useCallback(async (weekStartISO: string) => {
    if (!user) return;

    const weekStartDate = parseISO(weekStartISO);
    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

    const { data: bookingsData, error } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("user_id", user.id)
      .in("status", ["scheduled", "completed"])
      .neq("lesson_type", "Personal")
      .gte("start_time", weekStartDate.toISOString())
      .lte("end_time", weekEndDate.toISOString());

    if (!error) {
      let totalMinutes = 0;
      bookingsData?.forEach(booking => {
        const start = new Date(booking.start_time);
        const end = new Date(booking.end_time);
        totalMinutes += differenceInMinutes(end, start);
      });
      setTotalBookedHoursForSelectedWeek(totalMinutes / 60);
    }
  }, [user]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setIsLoadingDashboard(false);
      return;
    }

    setIsLoadingDashboard(true);
    const now = new Date();

    try {
      // Use profile from session context if available
      if (profile) {
        setInstructorName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim());
      }

      const [
        studentsCountRes,
        allScheduledBookingsRes,
        historicalTestsRes,
        carsRes,
        prePaidHoursRes
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact" }).eq("user_id", user.id).eq("is_past_student", false),
        supabase.from("bookings").select("id, title, description, start_time, end_time, status, lesson_type, students(name)").eq("user_id", user.id).eq("status", "scheduled").gte("start_time", now.toISOString()).order("start_time", { ascending: true }),
        supabase.from("driving_tests").select("id, student_id, test_date, passed, driving_faults, serious_faults, examiner_action, students(name)").eq("user_id", user.id).order("test_date", { ascending: false }),
        supabase.from("cars").select("id, make, model, year, initial_mileage, service_interval_miles, acquisition_date").eq("user_id", user.id),
        supabase.from("pre_paid_hours").select("package_hours, remaining_hours, students(name)").eq("user_id", user.id)
      ]);

      setTotalStudents(studentsCountRes.count);

      const scheduledBookings = allScheduledBookingsRes.data || [];
      setUpcomingLessons(scheduledBookings.slice(0, 20) as unknown as Booking[]);
      
      const testBookings = scheduledBookings.filter(b => b.lesson_type === "Driving Test");
      setUpcomingDrivingTestBookingsCount(testBookings.length);
      setNextDrivingTestBookings(testBookings.slice(0, 2) as unknown as Booking[]);

      const twelveMonthsAgo = subYears(now, 1);
      const recentTests = (historicalTestsRes.data || []).filter(test => isAfter(new Date(test.test_date), twelveMonthsAgo));
      if (recentTests.length > 0) {
        const total = recentTests.length;
        setDrivingTestStats({
          totalTests: total,
          passRate: (recentTests.filter(t => t.passed).length / total) * 100,
          avgDrivingFaults: recentTests.reduce((sum, t) => sum + t.driving_faults, 0) / total,
          avgSeriousFaults: recentTests.reduce((sum, t) => sum + t.serious_faults, 0) / total,
          examinerActionPercentage: (recentTests.filter(t => t.examiner_action).length / total) * 100,
        });
      }

      const hourlyRate = (profile as any)?.hourly_rate || 0;
      if (hourlyRate > 0) {
        let startDate: Date, endDate: Date;
        if (revenueTimeframe === "daily") { startDate = startOfDay(now); endDate = endOfDay(now); }
        else if (revenueTimeframe === "weekly") { startDate = startOfWeek(now, { weekStartsOn: 1 }); endDate = endOfWeek(now, { weekStartsOn: 1 }); }
        else { startDate = startOfMonth(now); endDate = endOfMonth(now); }

        const { data: revData } = await supabase
          .from("bookings")
          .select("start_time, end_time")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .neq("lesson_type", "Personal")
          .gte("start_time", startDate.toISOString())
          .lte("end_time", endDate.toISOString());
          
        let totalMins = 0;
        revData?.forEach(b => totalMins += differenceInMinutes(new Date(b.end_time), new Date(b.start_time)));
        setCurrentRevenue((totalMins / 60) * hourlyRate);
      }

      if (carsRes.data && carsRes.data.length > 0) {
        const car = carsRes.data[0]; // Just check the first car for the dashboard summary
        if (car.service_interval_miles) {
          const { data: mileageData } = await supabase.from("car_mileage_entries").select("current_mileage").eq("car_id", car.id).order("entry_date", { ascending: false }).limit(1).maybeSingle();
          const currentMileage = mileageData?.current_mileage || car.initial_mileage;
          const milesUntil = ((Math.floor(currentMileage / car.service_interval_miles) + 1) * car.service_interval_miles) - currentMileage;
          setMilesUntilNextServiceDashboard(milesUntil);
          setCarNeedingService(`${car.make} ${car.model}`);
        }
      }

      if (prePaidHoursRes.data) {
        let remaining = 0;
        const studentMap: { [name: string]: number } = {};
        prePaidHoursRes.data.forEach(pkg => {
          remaining += pkg.remaining_hours;
          const name = pkg.students?.name || "Unknown";
          studentMap[name] = (studentMap[name] || 0) + pkg.remaining_hours;
        });
        setTotalPrePaidHoursRemaining(remaining);
        setStudentsWithLowPrePaidHours(Object.keys(studentMap).filter(name => studentMap[name] <= 2 && studentMap[name] > 0));
      }

    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [user, profile, revenueTimeframe]);

  useEffect(() => {
    if (!isSessionLoading) fetchDashboardData();
  }, [isSessionLoading, fetchDashboardData]);

  useEffect(() => {
    if (!isSessionLoading && user) fetchBookedHoursForWeek(selectedWeekStartISO);
  }, [isSessionLoading, user, selectedWeekStartISO, fetchBookedHoursForWeek]);

  const generateWeekOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 2; i >= 1; i--) {
      const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      options.push({ label: `${format(start, "MMM dd")} - ${format(endOfWeek(start, { weekStartsOn: 1 }), "MMM dd")}`, value: start.toISOString() });
    }
    const currentStart = startOfWeek(now, { weekStartsOn: 1 });
    options.push({ label: "Current Week", value: currentStart.toISOString() });
    for (let i = 1; i <= 2; i++) {
      const start = startOfWeek(addWeeks(now, i), { weekStartsOn: 1 });
      options.push({ label: `${format(start, "MMM dd")} - ${format(endOfWeek(start, { weekStartsOn: 1 }), "MMM dd")}`, value: start.toISOString() });
    }
    return options;
  }, []);

  if (isSessionLoading || isLoadingDashboard) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  if (profile?.role?.toLowerCase() === 'owner') {
    return <OwnerDashboard />;
  }

  return (
    <div className="space-y-8 w-full px-4 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black tracking-tight text-foreground">{getGreeting()}, {instructorName || "Instructor"}</h1>
        <Button variant="outline" size="sm" onClick={() => setIsCustomizerOpen(true)} className="shadow-sm font-bold">
          <Settings2 className="mr-2 h-4 w-4" /> Customise
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {widgets.filter(w => w.visible).map((widget) => (
          <div key={widget.id} className={cn(widget.id === "quick_stats" && "lg:col-span-3", widget.id === "upcoming_lessons" && "lg:col-span-1 lg:row-span-2")}>
            {widget.id === "quick_stats" && (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                  <CardHeader className="pb-1 p-3"><CardTitle className="text-sm font-bold text-muted-foreground">Students</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-3xl font-black">{totalStudents ?? 0}</div></CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 shadow-sm">
                  <CardHeader className="pb-1 p-3"><CardTitle className="text-sm font-bold text-muted-foreground">Tests</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-3xl font-black">{upcomingDrivingTestBookingsCount ?? 0}</div></CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                  <CardHeader className="pb-1 p-3"><CardTitle className="text-sm font-bold text-muted-foreground">Booked Hrs</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-3xl font-black">{(totalBookedHoursForSelectedWeek ?? 0).toFixed(1)}</div></CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 shadow-sm">
                  <CardHeader className="pb-1 p-3"><CardTitle className="text-sm font-bold text-muted-foreground">Income</CardTitle></CardHeader>
                  <CardContent className="p-3 pt-0"><div className="text-3xl font-black">£{(currentRevenue ?? 0).toFixed(2)}</div></CardContent>
                </Card>
              </div>
            )}
            {widget.id === "upcoming_lessons" && (
              <Card className="h-full shadow-md border-none overflow-hidden">
                <CardHeader className="bg-primary text-primary-foreground p-4"><CardTitle className="text-xl font-bold">Upcoming Lessons</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {upcomingLessons.length === 0 ? <div className="p-12 text-center text-muted-foreground">No lessons scheduled.</div> : (
                    <div className="divide-y">
                      {upcomingLessons.slice(0, 5).map(b => (
                        <div key={b.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                          <div className="min-w-0">
                            <p className="font-bold truncate">{b.students?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(b.start_time), "MMM dd, p")}</p>
                          </div>
                          <Button variant="ghost" size="icon" asChild><Link to="/schedule"><ArrowRight className="h-4 w-4" /></Link></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Add other widget renders here as needed */}
          </div>
        ))}
      </div>

      <DashboardCustomizer isOpen={isCustomizerOpen} onClose={() => setIsCustomizerOpen(false)} widgets={widgets} onUpdateWidgets={saveWidgets} onReset={resetWidgets} />
    </div>
  );
};

export default Dashboard;