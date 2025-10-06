"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, startOfMonth, endOfMonth, subYears, differenceInMinutes, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { Users, CalendarDays, PoundSterling, Car, Hourglass, CheckCircle, XCircle, AlertTriangle, Hand, BookOpen, Clock, ArrowRight, Gauge } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

interface Student {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: string;
  students: {
    name: string;
  };
}

interface DrivingTest {
  id: string;
  student_id: string;
  student_name: string;
  test_date: string;
  passed: boolean;
  driving_faults: number;
  serious_faults: number;
  examiner_action: boolean;
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
  const [totalPrePaidHoursPurchased, setTotalPrePaidHoursPurchased] = useState<number | null>(null);
  const [totalPrePaidHoursRemaining, setTotalPrePaidHoursRemaining] = useState<number | null>(null);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setIsLoadingDashboard(false);
      return;
    }

    setIsLoadingDashboard(true);
    let hourlyRate = 0;

    try {
      // Fetch Instructor Name and Hourly Rate
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, last_name, hourly_rate")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        showError("Failed to load instructor profile.");
      } else if (profileData) {
        setInstructorName(`${profileData.first_name || ""} ${profileData.last_name || ""}`.trim());
        setCurrentHourlyRate(profileData.hourly_rate);
        hourlyRate = profileData.hourly_rate || 0;
      }

      // Fetch Total Students
      const { count: studentsCount, error: studentsError } = await supabase
        .from("students")
        .select("id", { count: "exact" })
        .eq("user_id", user.id);

      if (studentsError) {
        console.error("Error fetching students count:", studentsError);
        showError("Failed to load students count.");
      } else {
        setTotalStudents(studentsCount);
      }

      // Fetch Upcoming Lessons Count and List
      const now = new Date();
      const { data: upcomingLessonsData, count: upcomingLessonsTotalCount, error: upcomingLessonsError } = await supabase
        .from("bookings")
        .select("id, title, description, start_time, end_time, status, students(name)", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gte("start_time", now.toISOString())
        .order("start_time", { ascending: true })
        .limit(5);

      if (upcomingLessonsError) {
        console.error("Error fetching upcoming lessons:", upcomingLessonsError);
        showError("Failed to load upcoming lessons.");
      } else {
        setUpcomingLessonsCount(upcomingLessonsTotalCount);
        setUpcomingLessons(upcomingLessonsData || []);
      }

      // Calculate Revenue based on timeframe
      if (hourlyRate > 0) {
        let startDate: Date;
        let endDate: Date;

        switch (revenueTimeframe) {
          case "daily":
            startDate = startOfDay(now);
            endDate = endOfDay(now);
            break;
          case "weekly":
            startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday as start of week
            endDate = endOfWeek(now, { weekStartsOn: 1 });
            break;
          case "monthly":
          default:
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            break;
        }

        const { data: completedBookings, error: completedBookingsError } = await supabase
          .from("bookings")
          .select("start_time, end_time")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .gte("start_time", startDate.toISOString())
          .lte("end_time", endDate.toISOString());

        if (completedBookingsError) {
          console.error("Error fetching completed bookings for revenue:", completedBookingsError);
          showError("Failed to calculate revenue.");
        } else {
          let totalMinutes = 0;
          completedBookings?.forEach(booking => {
            const start = new Date(booking.start_time);
            const end = new Date(booking.end_time);
            totalMinutes += differenceInMinutes(end, start);
          });
          const calculatedRevenue = (totalMinutes / 60) * hourlyRate;
          setCurrentRevenue(calculatedRevenue);
        }
      } else {
        setCurrentRevenue(0);
      }

      // Fetch Upcoming Driving Test Bookings Count (from bookings table)
      const { count: upcomingTestBookingsCount, error: upcomingTestBookingsError } = await supabase
        .from("bookings")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
        .eq("lesson_type", "Driving Test") // Filter for Driving Test bookings
        .eq("status", "scheduled") // Only count scheduled tests
        .gte("start_time", now.toISOString()); // Only count future tests

      if (upcomingTestBookingsError) {
        console.error("Error fetching upcoming driving test bookings:", upcomingTestBookingsError);
        showError("Failed to load upcoming driving test bookings count.");
      } else {
        setUpcomingDrivingTestBookingsCount(upcomingTestBookingsCount);
      }

      // Fetch Next 2 Driving Test Bookings
      const { data: nextDrivingTestsData, error: nextDrivingTestsError } = await supabase
        .from("bookings")
        .select("id, title, description, start_time, end_time, status, students(name)")
        .eq("user_id", user.id)
        .eq("lesson_type", "Driving Test")
        .eq("status", "scheduled")
        .gte("start_time", now.toISOString())
        .order("start_time", { ascending: true })
        .limit(2);

      if (nextDrivingTestsError) {
        console.error("Error fetching next driving test bookings:", nextDrivingTestsError);
        showError("Failed to load next driving test bookings.");
      } else {
        setNextDrivingTestBookings(nextDrivingTestsData || []);
      }

      // Fetch Driving Test Stats (Last 12 Months) - still from driving_tests table for historical records
      const { data: allTestsData, error: allTestsError } = await supabase
        .from("driving_tests")
        .select("id, student_id, test_date, passed, driving_faults, serious_faults, examiner_action, students(name)")
        .eq("user_id", user.id)
        .order("test_date", { ascending: false });

      if (allTestsError) {
        console.error("Error fetching all driving tests for stats:", allTestsError);
        showError("Failed to load driving test statistics.");
        setDrivingTestStats(null);
      } else {
        const twelveMonthsAgo = subYears(now, 1);
        const recentTests = (allTestsData || []).filter(test => isAfter(new Date(test.test_date), twelveMonthsAgo));

        if (recentTests.length > 0) {
          const totalTests = recentTests.length;
          const passedTests = recentTests.filter(test => test.passed).length;
          const totalDrivingFaults = recentTests.reduce((sum, test) => sum + test.driving_faults, 0);
          const totalSeriousFaults = recentTests.reduce((sum, test) => sum + test.serious_faults, 0);
          const examinerActions = recentTests.filter(test => test.examiner_action).length;

          setDrivingTestStats({
            totalTests: totalTests,
            passRate: (passedTests / totalTests) * 100,
            avgDrivingFaults: totalDrivingFaults / totalTests,
            avgSeriousFaults: totalSeriousFaults / totalTests,
            examinerActionPercentage: (examinerActions / totalTests) * 100,
          });
        } else {
          setDrivingTestStats({
            totalTests: 0,
            passRate: 0,
            avgDrivingFaults: 0,
            avgSeriousFaults: 0,
            examinerActionPercentage: 0,
          });
        }
      }

      // Fetch Cars and calculate Miles Until Next Service
      const { data: carsData, error: carsError } = await supabase
        .from("cars")
        .select("id, make, model, year, initial_mileage, service_interval_miles")
        .eq("user_id", user.id);

      if (carsError) {
        console.error("Error fetching cars for service interval:", carsError);
        showError("Failed to load car service data.");
      } else if (carsData && carsData.length > 0) {
        let minMilesUntilService: number | null = null;
        let carNameForService: string | null = null;

        for (const car of carsData) {
          if (car.service_interval_miles && car.service_interval_miles > 0) {
            const { data: latestMileageEntry, error: mileageError } = await supabase
              .from("car_mileage_entries")
              .select("current_mileage")
              .eq("car_id", car.id)
              .order("entry_date", { ascending: false })
              .limit(1)
              .single();

            let currentMileage = car.initial_mileage;
            if (mileageError && mileageError.code !== 'PGRST116') { // PGRST116 means no rows found
              console.error(`Error fetching mileage for car ${car.id}:`, mileageError);
              // If it's a real error, currentMileage remains initial_mileage
            } else if (latestMileageEntry) {
              currentMileage = latestMileageEntry.current_mileage;
            }

            const serviceInterval = car.service_interval_miles;
            const intervalsPassed = Math.floor(currentMileage / serviceInterval);
            const nextServiceMiles = (intervalsPassed + 1) * serviceInterval;
            const milesUntilService = nextServiceMiles - currentMileage;

            if (minMilesUntilService === null || milesUntilService < minMilesUntilService) {
              minMilesUntilService = milesUntilService;
              carNameForService = `${car.make} ${car.model}`;
            }
          }
        }
        setMilesUntilNextServiceDashboard(minMilesUntilService);
        setCarNeedingService(carNameForService);
      } else {
        setMilesUntilNextServiceDashboard(null);
        setCarNeedingService(null);
      }

      // Fetch Pre-Paid Hours Summary
      const { data: prePaidHoursData, error: prePaidHoursError } = await supabase
        .from("pre_paid_hours")
        .select("package_hours, remaining_hours")
        .eq("user_id", user.id);

      if (prePaidHoursError) {
        console.error("Error fetching pre-paid hours summary:", prePaidHoursError);
        showError("Failed to load pre-paid hours summary.");
        setTotalPrePaidHoursPurchased(null);
        setTotalPrePaidHoursRemaining(null);
      } else {
        let totalPurchased = 0;
        let totalRemaining = 0;
        prePaidHoursData.forEach(pkg => {
          totalPurchased += pkg.package_hours;
          totalRemaining += pkg.remaining_hours;
        });
        setTotalPrePaidHoursPurchased(totalPurchased);
        setTotalPrePaidHoursRemaining(totalRemaining);
      }

    } catch (error) {
      console.error("Unhandled error fetching dashboard data:", error);
      showError("An unexpected error occurred while loading dashboard data.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [user, revenueTimeframe]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchDashboardData();
    }
  }, [isSessionLoading, fetchDashboardData]);

  const displayInstructorName = instructorName || "Instructor";

  if (isSessionLoading || isLoadingDashboard) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        </div>
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        </div>
        <Skeleton className="h-8 w-48" /> {/* Skeleton for the new section title */}
        <div className="grid gap-4 md:grid-cols-2"> {/* Skeleton for the new section cards */}
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        </div>
        <Skeleton className="h-8 w-48" /> {/* Skeleton for the new Miles Until Next Service card */}
        <Skeleton className="h-8 w-48" /> {/* Skeleton for the new Pre-Paid Hours Summary card */}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{getGreeting()}, {displayInstructorName}</h1>

      {/* Row of 4 Key Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents !== null ? totalStudents : <Skeleton className="h-6 w-1/4" />}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Lessons</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingLessonsCount !== null ? upcomingLessonsCount : <Skeleton className="h-6 w-1/4" />}</div>
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
            {currentHourlyRate === null || currentHourlyRate === 0 ? (
              <div className="text-sm text-muted-foreground">
                Set your <Link to="/settings" className="text-blue-500 hover:underline">hourly rate</Link> in settings to calculate revenue.
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">£{currentRevenue !== null ? currentRevenue.toFixed(2) : <Skeleton className="h-6 w-1/2" />}</div>
                <p className="text-xs text-muted-foreground">
                  (from completed lessons this period)
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Upcoming Driving Tests</CardTitle>
              <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                <Link to="/driving-test-bookings">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingDrivingTestBookingsCount !== null ? upcomingDrivingTestBookingsCount : <Skeleton className="h-6 w-1/4" />}</div>
          </CardContent>
        </Card>
      </div>

      {/* Combined section for Driving Test Overview and Upcoming Lessons */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Lessons Section */}
        <Card className="flex flex-col"> {/* Wrapped in Card */}
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Upcoming Lessons</CardTitle>
          </CardHeader>
          <CardContent className="flex-1"> {/* Added flex-1 to CardContent */}
            {upcomingLessons.length === 0 ? (
              <p className="text-muted-foreground">No upcoming lessons scheduled. Go to the Schedule page to add one!</p>
            ) : (
              <ScrollArea className="h-96 pr-4">
                <div className="grid gap-4">
                  {upcomingLessons.map((booking) => (
                    <Card key={booking.id} className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{booking.title}</CardTitle>
                        {booking.students?.name && (
                          <CardDescription className="flex items-center text-muted-foreground">
                            <Users className="mr-2 h-4 w-4" />
                            <span>Student: {booking.students.name}</span>
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="flex-1 space-y-2 text-sm">
                        {booking.description && (
                          <p className="text-muted-foreground italic">{booking.description}</p>
                        )}
                        <div className="flex items-center text-muted-foreground">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          <span>{format(new Date(booking.start_time), "PPP")}</span>
                        </div>
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="mr-2 h-4 w-4" />
                          <span>
                            {format(new Date(booking.start_time), "p")} - {format(new Date(booking.end_time), "p")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Right column: Driving Test Overview and Next Driving Tests */}
        <Card className="flex flex-col p-6 space-y-6"> {/* Wrapped in a single Card */}
          {/* Driving Test Overview Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-2xl font-bold">Driving Test Overview (Last 12 Months)</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/driving-tests"> {/* Corrected link here */}
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            {drivingTestStats && drivingTestStats.totalTests > 0 ? (
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tests Taken</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{drivingTestStats.totalTests}</p>
                  </CardContent>
                </Card>
                <Card className={cn(
                  drivingTestStats.passRate <= 55 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                )}>
                  <CardHeader>
                    <CardTitle className="text-sm">Pass Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{drivingTestStats.passRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card className={cn(
                  drivingTestStats.avgDrivingFaults >= 6 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                )}>
                  <CardHeader>
                    <CardTitle className="text-sm">Avg. Driving Faults</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{drivingTestStats.avgDrivingFaults.toFixed(1)}</p>
                  </CardContent>
                </Card>
                <Card className={cn(
                  drivingTestStats.avgSeriousFaults >= 0.55 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                )}>
                  <CardHeader>
                    <CardTitle className="text-sm">Avg. Serious Faults</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{drivingTestStats.avgSeriousFaults.toFixed(1)}</p>
                  </CardContent>
                </Card>
                <Card className={cn(
                  drivingTestStats.examinerActionPercentage >= 10 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                )}>
                  <CardHeader>
                    <CardTitle className="text-sm">Examiner Action Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{drivingTestStats.examinerActionPercentage.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-muted-foreground">No driving test data available for the last 12 months.</p>
            )}
          </div>

          {/* Next 2 Driving Test Bookings Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">Next Driving Tests</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/driving-test-bookings">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            {nextDrivingTestBookings.length === 0 ? (
              <p className="text-muted-foreground">No upcoming driving test bookings found. Go to the Schedule page to add one!</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {nextDrivingTestBookings.map((booking) => (
                  <Card key={booking.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg">{booking.title}</CardTitle>
                      {booking.students?.name && (
                        <CardDescription className="flex items-center text-muted-foreground">
                          <Users className="mr-2 h-4 w-4" />
                          <span>Student: {booking.students.name}</span>
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2 text-sm">
                      {booking.description && (
                        <p className="text-muted-foreground italic">{booking.description}</p>
                      )}
                      <div className="flex items-center text-muted-foreground">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>{format(new Date(booking.start_time), "PPP")}</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        <span>
                          {format(new Date(booking.start_time), "p")} - {format(new Date(booking.end_time), "p")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Miles Until Next Service Card - New Section */}
      <Card className={cn(
        "lg:col-span-2", // This will make it span the full width below the 2-column grid
        milesUntilNextServiceDashboard !== null && milesUntilNextServiceDashboard < 1000 ? "bg-orange-100 text-orange-800" : ""
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Miles Until Next Service</CardTitle>
          <Gauge className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {milesUntilNextServiceDashboard !== null ? (
            <>
              <div className="text-2xl font-bold">
                {milesUntilNextServiceDashboard.toFixed(0)}
                <span className="text-lg text-muted-foreground ml-2">miles</span>
              </div>
              {carNeedingService && (
                <p className="text-xs text-muted-foreground">
                  ({carNeedingService} needs service soonest)
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No cars with service intervals or mileage data. Add a <Link to="/mileage-tracker" className="text-blue-500 hover:underline">car</Link> to track.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pre-Paid Hours Summary Card - New Section */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pre-Paid Hours Summary</CardTitle>
          <Hourglass className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {totalPrePaidHoursPurchased !== null && totalPrePaidHoursRemaining !== null ? (
            <>
              <div className="text-2xl font-bold">
                {totalPrePaidHoursRemaining.toFixed(1)} / {totalPrePaidHoursPurchased.toFixed(1)}
                <span className="text-lg text-muted-foreground ml-2">hours remaining</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total hours purchased across all students.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/pre-paid-hours">
                  View All Pre-Paid Hours <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No pre-paid hours data available. Add <Link to="/pre-paid-hours" className="text-blue-500 hover:underline">pre-paid hours</Link> to track.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;