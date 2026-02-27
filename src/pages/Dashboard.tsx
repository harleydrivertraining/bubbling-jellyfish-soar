"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, startOfMonth, endOfMonth, subYears, differenceInMinutes, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
import { Users, CalendarDays, PoundSterling, Car, Hourglass, CheckCircle, XCircle, AlertTriangle, Hand, BookOpen, Clock, ArrowRight, Gauge, TrendingUp, ShieldAlert, Calendar, ChevronDown, ChevronUp } from "lucide-react";
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

const Dashboard: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [instructorName, setInstructorName] = useState<string | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [upcomingLessonsCount, setUpcomingLessonsCount] = useState<number | null>(null);
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
      setUpcomingLessonsCount(scheduledBookings.length);
      // Fetch up to 20 lessons for the expanded view
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

  if (isSessionLoading || isLoadingDashboard) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{getGreeting()}, {instructorName || "Instructor"}</h1>

        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Lessons</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingLessonsCount ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Income</CardTitle>
                <Select onValueChange={(value: RevenueTimeframe) => setRevenueTimeframe(value)} defaultValue={revenueTimeframe}>
                  <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue placeholder="Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {currentHourlyRate ? (
                <>
                  <div className="text-2xl font-bold">£{(currentRevenue ?? 0).toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">(from completed lessons)</p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Set <Link to="/settings" className="text-blue-500 hover:underline">hourly rate</Link> to calculate.</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Upcoming Tests</CardTitle>
                <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                  <Link to="/driving-test-bookings">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingDrivingTestBookingsCount ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">Upcoming Lessons</CardTitle>
                  <CardDescription>Your next scheduled sessions</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/schedule" className="flex items-center">
                    Full Schedule <Calendar className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {upcomingLessons.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">No upcoming lessons scheduled.</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/schedule">Book a Lesson</Link>
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="divide-y">
                    {displayedLessons.map((booking) => {
                      const startTime = new Date(booking.start_time);
                      const isLessonToday = isToday(startTime);
                      
                      return (
                        <div key={booking.id} className={cn(
                          "p-4 transition-colors hover:bg-muted/50 flex items-start gap-4",
                          isLessonToday && "bg-primary/5"
                        )}>
                          <div className="flex flex-col items-center justify-center min-w-[60px] py-1 rounded-lg bg-muted border">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">{format(startTime, "MMM")}</span>
                            <span className="text-xl font-bold leading-none">{format(startTime, "dd")}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-base truncate pr-2">{booking.students?.name || "Unknown Student"}</h4>
                              {isLessonToday && (
                                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-[10px] h-5 px-1.5">TODAY</Badge>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Clock className="mr-1.5 h-3.5 w-3.5" />
                                <span>{format(startTime, "p")} - {format(new Date(booking.end_time), "p")}</span>
                              </div>
                              <div className="flex items-center">
                                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                                <span className="capitalize">{booking.lesson_type}</span>
                              </div>
                            </div>
                            
                            {booking.description && (
                              <p className="mt-2 text-xs text-muted-foreground italic line-clamp-1 border-l-2 pl-2 border-muted-foreground/20">
                                {booking.description}
                              </p>
                            )}
                          </div>
                          
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                            <Link to="/schedule">
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {upcomingLessons.length > 3 && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllLessons(!showAllLessons)}
                        className="text-primary font-semibold hover:bg-primary/5 w-full"
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

          <Card className="flex flex-col p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-6">
                <CardTitle className="text-2xl font-bold">Test Overview (12m)</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link to="/driving-tests">View All <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
              {drivingTestStats && drivingTestStats.totalTests > 0 ? (
                <div className="grid gap-4 grid-cols-2">
                  {/* Pass Rate */}
                  <div className={cn(
                    "p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all hover:shadow-md",
                    drivingTestStats.passRate <= 55 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900"
                  )}>
                    <div className="p-2 rounded-full bg-white/50">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium uppercase tracking-wider opacity-70">Pass Rate</p>
                      <p className="text-2xl font-bold">{drivingTestStats.passRate.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Avg Driving Faults */}
                  <div className={cn(
                    "p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all hover:shadow-md",
                    drivingTestStats.avgDrivingFaults >= 6 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900"
                  )}>
                    <div className="p-2 rounded-full bg-white/50">
                      <Car className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium uppercase tracking-wider opacity-70">Avg D.F.</p>
                      <p className="text-2xl font-bold">{drivingTestStats.avgDrivingFaults.toFixed(1)}</p>
                    </div>
                  </div>

                  {/* Avg Serious Faults */}
                  <div className={cn(
                    "p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all hover:shadow-md",
                    drivingTestStats.avgSeriousFaults >= 0.55 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900"
                  )}>
                    <div className="p-2 rounded-full bg-white/50">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium uppercase tracking-wider opacity-70">Avg S.F.</p>
                      <p className="text-2xl font-bold">{drivingTestStats.avgSeriousFaults.toFixed(1)}</p>
                    </div>
                  </div>

                  {/* Examiner Action */}
                  <div className={cn(
                    "p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all hover:shadow-md",
                    drivingTestStats.examinerActionPercentage >= 10 ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-green-50 border-green-200 text-green-900"
                  )}>
                    <div className="p-2 rounded-full bg-white/50">
                      <Hand className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium uppercase tracking-wider opacity-70">Ex. Act.</p>
                      <p className="text-2xl font-bold">{drivingTestStats.examinerActionPercentage.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ) : <p className="text-muted-foreground">No test data available.</p>}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold">Next Driving Tests</CardTitle>
              </div>
              {nextDrivingTestBookings.length === 0 ? (
                <p className="text-muted-foreground">No upcoming tests.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {nextDrivingTestBookings.map((booking) => (
                    <Card key={booking.id} className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{booking.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex items-center text-muted-foreground">
                          <CalendarDays className="mr-1 h-3 w-3" />
                          <span>{format(new Date(booking.start_time), "MMM dd")}</span>
                        </div>
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          <span>{format(new Date(booking.start_time), "p")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className={cn(milesUntilNextServiceDashboard !== null && milesUntilNextServiceDashboard < 1000 ? "bg-orange-50" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Service</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {milesUntilNextServiceDashboard !== null ? (
                <>
                  <div className="text-2xl font-bold">{milesUntilNextServiceDashboard.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">miles</span></div>
                  {carNeedingService && <p className="text-xs text-muted-foreground">({carNeedingService})</p>}
                </>
              ) : <p className="text-xs text-muted-foreground">No car data available.</p>}
            </CardContent>
          </Card>

          <Card className={cn(totalPrePaidHoursRemaining !== null && totalPrePaidHoursRemaining <= 2 ? "bg-orange-50" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pre-Paid Hours</CardTitle>
              <Hourglass className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {totalPrePaidHoursRemaining !== null ? (
                <>
                  <div className="text-2xl font-bold">{totalPrePaidHoursRemaining.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">hrs</span></div>
                  {studentsWithLowPrePaidHours.length > 0 && <p className="text-xs text-orange-800 mt-1">Low: {studentsWithLowPrePaidHours.join(", ")}</p>}
                </>
              ) : <p className="text-xs text-muted-foreground">No pre-paid data.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Booked Hours</CardTitle>
                <Select onValueChange={setSelectedWeekStartISO} defaultValue={selectedWeekStartISO}>
                  <SelectTrigger className="w-[130px] h-7 text-xs">
                    <SelectValue placeholder="Select Week" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateWeekOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(totalBookedHoursForSelectedWeek ?? 0).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">hrs</span></div>
              <p className="text-xs text-muted-foreground mt-1">Scheduled & completed bookings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </React.Fragment>
  );
};

export default Dashboard;