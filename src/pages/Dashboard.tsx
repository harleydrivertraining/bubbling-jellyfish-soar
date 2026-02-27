"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, startOfMonth, endOfMonth, subYears, differenceInMinutes, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
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
  const { user, isLoading: isSessionLoading } = useSession();
  const [instructorName, setInstructorName] = useState<string | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [currentRevenue, setCurrentRevenue] = useState<number | null>(null);
  const [upcomingDrivingTestBookingsCount, setUpcomingDrivingTestBookingsCount] = useState<number | null>(null);
  const [drivingTestStats, setDrivingTestStats] = useState<DrivingTestStats | null>(null);
  const [upcomingLessons, setUpcomingLessons] = useState<Booking[]>([]);
  const [nextDrivingTestBookings, setNextDrivingTestBookings] = useState<Booking[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [currentHourlyRate, setCurrentHourlyRate] = useState<number | null>(null);
  const [revenueTimeframe, setRevenueTimeframe] = useState<RevenueTimeframe>("weekly");
  const [milesUntilNextServiceDashboard, setMilesUntilNextServiceDashboard] = useState<number | null>(null);
  const [carNeedingService, setCarNeedingService] = useState<string | null>(null);
  const [totalPrePaidHoursRemaining, setTotalPrePaidHoursRemaining] = useState<number | null>(null);
  const [studentsWithLowPrePaidHours, setStudentsWithLowPrePaidHours] = useState<string[]>([]);

  const [totalBookedHoursForSelectedWeek, setTotalBookedHoursForSelectedWeek] = useState<number | null>(null);
  const [selectedWeekStartISO, setSelectedWeekStartISO] = useState<string>(startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString());
  
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);

  // Load widgets from localStorage
  useEffect(() => {
    const savedWidgets = localStorage.getItem("dashboard_widgets");
    if (savedWidgets) {
      try {
        const parsed = JSON.parse(savedWidgets);
        const merged = DEFAULT_WIDGETS.map(def => {
          const saved = parsed.find((p: DashboardWidget) => p.id === def.id);
          return saved ? saved : def;
        });
        const extra = parsed.filter((p: DashboardWidget) => !DEFAULT_WIDGETS.find(def => def.id === p.id));
        setWidgets([...merged, ...extra]);
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
      .gte("start_time", weekStartDate.toISOString())
      .lte("end_time", weekEndDate.toISOString());

    if (error) {
      console.error("Error fetching booked hours for week:", error);
      setTotalBookedHoursForSelectedWeek(null);
    } else {
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
      const [
        profileRes,
        studentsCountRes,
        allScheduledBookingsRes,
        historicalTestsRes,
        carsRes,
        prePaidHoursRes
      ] = await Promise.all([
        supabase.from("profiles").select("first_name, last_name, hourly_rate").eq("id", user.id).single(),
        supabase.from("students").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("bookings").select("id, title, description, start_time, end_time, status, lesson_type, students(name)").eq("user_id", user.id).eq("status", "scheduled").gte("start_time", now.toISOString()).order("start_time", { ascending: true }),
        supabase.from("driving_tests").select("id, student_id, test_date, passed, driving_faults, serious_faults, examiner_action, students(name)").eq("user_id", user.id).order("test_date", { ascending: false }),
        supabase.from("cars").select("id, make, model, year, initial_mileage, service_interval_miles").eq("user_id", user.id),
        supabase.from("pre_paid_hours").select("package_hours, remaining_hours, students(name)").eq("user_id", user.id)
      ]);

      if (profileRes.data) {
        setInstructorName(`${profileRes.data.first_name || ""} ${profileRes.data.last_name || ""}`.trim());
        setCurrentHourlyRate(profileRes.data.hourly_rate);
      }

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
      } else {
        setDrivingTestStats({ totalTests: 0, passRate: 0, avgDrivingFaults: 0, avgSeriousFaults: 0, examinerActionPercentage: 0 });
      }

      const hourlyRate = profileRes.data?.hourly_rate || 0;
      if (hourlyRate > 0) {
        let startDate: Date, endDate: Date;
        if (revenueTimeframe === "daily") { startDate = startOfDay(now); endDate = endOfDay(now); }
        else if (revenueTimeframe === "weekly") { startDate = startOfWeek(now, { weekStartsOn: 1 }); endDate = endOfWeek(now, { weekStartsOn: 1 }); }
        else { startDate = startOfMonth(now); endDate = endOfMonth(now); }

        const { data: revData } = await supabase.from("bookings").select("start_time, end_time").eq("user_id", user.id).eq("status", "completed").gte("start_time", startDate.toISOString()).lte("end_time", endDate.toISOString());
        let totalMins = 0;
        revData?.forEach(b => totalMins += differenceInMinutes(new Date(b.end_time), new Date(b.start_time)));
        setCurrentRevenue((totalMins / 60) * hourlyRate);
      } else {
        setCurrentRevenue(0);
      }

      if (carsRes.data && carsRes.data.length > 0) {
        const mileageResults = await Promise.all(carsRes.data.map(async (car) => {
          const { data } = await supabase.from("car_mileage_entries").select("current_mileage").eq("car_id", car.id).order("entry_date", { ascending: false }).limit(1).single();
          return { carId: car.id, currentMileage: data?.current_mileage || car.initial_mileage };
        }));

        let minMiles: number | null = null;
        let carName: string | null = null;

        carsRes.data.forEach(car => {
          if (car.service_interval_miles && car.service_interval_miles > 0) {
            const currentMileage = mileageResults.find(m => m.carId === car.id)?.currentMileage || car.initial_mileage;
            const milesUntil = ((Math.floor(currentMileage / car.service_interval_miles) + 1) * car.service_interval_miles) - currentMileage;
            if (minMiles === null || milesUntil < minMiles) {
              minMiles = milesUntil;
              carName = `${car.make} ${car.model}`;
            }
          }
        });
        setMilesUntilNextServiceDashboard(minMiles);
        setCarNeedingService(carName);
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

    } catch (err) {
      console.error("Dashboard fetch error:", err);
      showError("Failed to load dashboard data.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [user, revenueTimeframe]);

  useEffect(() => {
    if (!isSessionLoading) fetchDashboardData();
  }, [isSessionLoading, fetchDashboardData]);

  useEffect(() => {
    if (!isSessionLoading && user) fetchBookedHoursForWeek(selectedWeekStartISO);
  }, [isSessionLoading, user, selectedWeekStartISO, fetchBookedHoursForWeek]);

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

  const displayedLessons = useMemo(() => {
    return showAllLessons ? upcomingLessons : upcomingLessons.slice(0, 3);
  }, [upcomingLessons, showAllLessons]);

  const renderWidget = (id: string) => {
    switch (id) {
      case "quick_stats":
        return (
          <div key={id} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStudents ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Active learners</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Booked Hours</CardTitle>
                  <Select onValueChange={setSelectedWeekStartISO} defaultValue={selectedWeekStartISO}>
                    <SelectTrigger className="w-[110px] h-6 text-[10px] px-2">
                      <SelectValue placeholder="Select Week" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateWeekOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <CalendarDays className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(totalBookedHoursForSelectedWeek ?? 0).toFixed(1)} <span className="text-xs font-bold text-muted-foreground uppercase">hrs</span></div>
                <p className="text-xs text-muted-foreground mt-1">Scheduled sessions</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
                  <Select onValueChange={(value: RevenueTimeframe) => setRevenueTimeframe(value)} defaultValue={revenueTimeframe}>
                    <SelectTrigger className="w-[90px] h-6 text-[10px] px-2">
                      <SelectValue placeholder="Timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <PoundSterling className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                {currentHourlyRate ? (
                  <>
                    <div className="text-2xl font-bold">£{(currentRevenue ?? 0).toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">From completed lessons</p>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Set <Link to="/settings" className="text-blue-500 hover:underline">hourly rate</Link></div>
                )}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Tests</CardTitle>
                <Car className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingDrivingTestBookingsCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Driving test bookings</p>
              </CardContent>
            </Card>
          </div>
        );
      case "upcoming_lessons":
        return (
          <Card key={id} className="flex flex-col overflow-hidden shadow-md border-none h-full">
            <CardHeader className="bg-primary text-primary-foreground">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Upcoming Lessons</CardTitle>
                  <CardDescription className="text-primary-foreground/70">Your next scheduled sessions</CardDescription>
                </div>
                <Button asChild variant="secondary" size="sm" className="h-8">
                  <Link to="/schedule" className="flex items-center">
                    Full Schedule <Calendar className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 bg-card">
              {upcomingLessons.length === 0 ? (
                <div className="p-12 text-center">
                  <Calendar className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">No upcoming lessons scheduled.</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/schedule">Book a Lesson</Link>
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="divide-y divide-muted">
                    {displayedLessons.map((booking) => {
                      const startTime = new Date(booking.start_time);
                      const isLessonToday = isToday(startTime);
                      
                      return (
                        <div key={booking.id} className={cn(
                          "p-5 transition-all hover:bg-muted/30 flex items-start gap-5",
                          isLessonToday && "bg-primary/5 border-l-4 border-l-primary"
                        )}>
                          <div className="flex flex-col items-center justify-center min-w-[64px] py-2 rounded-xl bg-muted border shadow-sm">
                            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">{format(startTime, "MMM")}</span>
                            <span className="text-2xl font-black leading-none">{format(startTime, "dd")}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <h4 className="font-bold text-lg truncate pr-2 text-foreground">{booking.students?.name || "Unknown Student"}</h4>
                              {isLessonToday && (
                                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-[10px] font-bold h-5 px-2">TODAY</Badge>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Clock className="mr-2 h-4 w-4 text-primary/60" />
                                <span className="font-medium">{format(startTime, "p")} - {format(new Date(booking.end_time), "p")}</span>
                              </div>
                              <div className="flex items-center">
                                <BookOpen className="mr-2 h-4 w-4 text-primary/60" />
                                <span className="capitalize font-medium">{booking.lesson_type}</span>
                              </div>
                            </div>
                            
                            {booking.description && (
                              <p className="mt-3 text-xs text-muted-foreground italic line-clamp-2 bg-muted/50 p-2 rounded-md border-l-2 border-primary/30">
                                "{booking.description}"
                              </p>
                            )}
                          </div>
                          
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors" asChild>
                            <Link to="/schedule">
                              <ArrowRight className="h-5 w-5" />
                            </Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {upcomingLessons.length > 3 && (
                    <div className="p-4 text-center border-t bg-muted/5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllLessons(!showAllLessons)}
                        className="text-primary font-bold hover:bg-primary/5 w-full py-6"
                      >
                        {showAllLessons ? (
                          <>Show Less <ChevronUp className="ml-2 h-4 w-4" /></>
                        ) : (
                          <>View More ({upcomingLessons.length - 3} more) <ChevronDown className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        );
      case "test_stats":
        return (
          <Card key={id} className="p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <CardTitle className="text-lg font-bold">Test Performance</CardTitle>
                <CardDescription className="text-sm">Last 12 months</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-primary font-semibold">
                <Link to="/test-statistics">Full Stats <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            {drivingTestStats && drivingTestStats.totalTests > 0 ? (
              <div className="grid gap-3 grid-cols-2">
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all",
                  drivingTestStats.passRate <= 55 ? "bg-orange-50 border-orange-100 text-orange-900" : "bg-green-50 border-green-100 text-green-900"
                )}>
                  <TrendingUp className="h-5 w-5 opacity-60" />
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70">Pass Rate</p>
                  <p className="text-2xl font-black">{drivingTestStats.passRate.toFixed(1)}%</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all",
                  drivingTestStats.avgDrivingFaults >= 6 ? "bg-orange-50 border-orange-100 text-orange-900" : "bg-green-50 border-green-100 text-green-900"
                )}>
                  <Car className="h-5 w-5 opacity-60" />
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70">Avg D.F.</p>
                  <p className="text-2xl font-black">{drivingTestStats.avgDrivingFaults.toFixed(1)}</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all",
                  drivingTestStats.avgSeriousFaults >= 0.55 ? "bg-orange-50 border-orange-100 text-orange-900" : "bg-green-50 border-green-100 text-green-900"
                )}>
                  <ShieldAlert className="h-5 w-5 opacity-60" />
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70">Avg S.F.</p>
                  <p className="text-2xl font-black">{drivingTestStats.avgSeriousFaults.toFixed(1)}</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col items-center justify-center space-y-1 transition-all",
                  drivingTestStats.examinerActionPercentage >= 10 ? "bg-orange-50 border-orange-100 text-orange-900" : "bg-green-50 border-green-100 text-green-900"
                )}>
                  <Hand className="h-5 w-5 opacity-60" />
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70">Ex. Act.</p>
                  <p className="text-2xl font-black">{drivingTestStats.examinerActionPercentage.toFixed(1)}%</p>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">No test data available.</p>}
          </Card>
        );
      case "next_tests":
        return (
          <Card key={id} className="p-6 shadow-sm h-full">
            <CardTitle className="text-lg font-bold mb-4 flex items-center">
              <GraduationCap className="mr-2 h-5 w-5 text-primary" />
              Next Driving Tests
            </CardTitle>
            {nextDrivingTestBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No upcoming tests scheduled.</p>
            ) : (
              <div className="space-y-3">
                {nextDrivingTestBookings.map((booking) => (
                  <div key={booking.id} className="p-4 rounded-lg bg-muted/40 border border-muted flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-base truncate">{booking.students?.name || "Unknown Student"}</p>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                        <span>{format(new Date(booking.start_time), "MMM dd")} at {format(new Date(booking.start_time), "p")}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10" asChild>
                      <Link to="/driving-test-bookings"><ArrowRight className="h-5 w-5" /></Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      case "service_info":
        return (
          <Card key={id} className={cn("shadow-sm h-full", milesUntilNextServiceDashboard !== null && milesUntilNextServiceDashboard < 1000 ? "bg-orange-50 border-orange-200" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Vehicle Service</CardTitle>
              <Gauge className={cn("h-4 w-4", milesUntilNextServiceDashboard !== null && milesUntilNextServiceDashboard < 1000 ? "text-orange-600" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              {milesUntilNextServiceDashboard !== null ? (
                <>
                  <div className="text-2xl font-black">{milesUntilNextServiceDashboard.toFixed(0)} <span className="text-xs font-bold text-muted-foreground uppercase">miles</span></div>
                  {carNeedingService && <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-tight">{carNeedingService}</p>}
                  {milesUntilNextServiceDashboard < 1000 && (
                    <Badge variant="outline" className="mt-2 bg-white text-orange-700 border-orange-200 text-[10px] font-bold">SERVICE SOON</Badge>
                  )}
                </>
              ) : <p className="text-xs text-muted-foreground">No car data available.</p>}
            </CardContent>
          </Card>
        );
      case "prepaid_info":
        return (
          <Card key={id} className={cn("shadow-sm h-full", totalPrePaidHoursRemaining !== null && totalPrePaidHoursRemaining <= 2 ? "bg-red-50 border-red-200" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Pre-Paid Hours</CardTitle>
              <Hourglass className={cn("h-4 w-4", totalPrePaidHoursRemaining !== null && totalPrePaidHoursRemaining <= 2 ? "text-red-600" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              {totalPrePaidHoursRemaining !== null ? (
                <>
                  <div className="text-2xl font-black">{totalPrePaidHoursRemaining.toFixed(1)} <span className="text-xs font-bold text-muted-foreground uppercase">hrs</span></div>
                  {studentsWithLowPrePaidHours.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-bold text-red-700 uppercase">Low Balance:</p>
                      <p className="text-xs text-red-600 truncate">{studentsWithLowPrePaidHours.join(", ")}</p>
                    </div>
                  )}
                </>
              ) : <p className="text-xs text-muted-foreground">No pre-paid data.</p>}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  if (isSessionLoading || isLoadingDashboard) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><Skeleton className="h-[500px] w-full" /></div>
          <div className="space-y-6"><Skeleton className="h-[240px] w-full" /><Skeleton className="h-[240px] w-full" /></div>
        </div>
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="space-y-8 w-full px-4 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">{getGreeting()}, {instructorName || "Instructor"}</h1>
            <p className="text-muted-foreground font-medium mt-1">Here's what's happening with your driving school today.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {widgets.filter(w => w.visible).map((widget) => (
            <div 
              key={widget.id} 
              className={cn(
                widget.id === "quick_stats" && "lg:col-span-3",
                widget.id !== "quick_stats" && "lg:col-span-1"
              )}
            >
              {renderWidget(widget.id)}
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-8 border-t">
          <Button variant="outline" size="sm" onClick={() => setIsCustomizerOpen(true)} className="shadow-sm font-bold">
            <Settings2 className="mr-2 h-4 w-4" /> Customise Dashboard
          </Button>
        </div>
      </div>

      <DashboardCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        widgets={widgets}
        onUpdateWidgets={saveWidgets}
        onReset={resetWidgets}
      />
    </React.Fragment>
  );
};

export default Dashboard;