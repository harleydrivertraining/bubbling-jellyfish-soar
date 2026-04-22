"use client";

import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import BookingRequestAlert from "@/components/BookingRequestAlert";
import AIAssistant from "@/components/AIAssistant";
import { useQuery } from "@tanstack/react-query";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  addMonths, 
  startOfWeek, 
  endOfWeek 
} from "date-fns";

const Layout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { session, user, isLoading, isProfileLoading, subscriptionStatus, userRole } = useSession();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // --- BACKGROUND PREFETCHING ---
  
  // 1. Prefetch Student Profile (if student)
  const { data: studentData } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, user_id, auth_user_id")
        .eq("auth_user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === 'student',
    staleTime: 1000 * 60 * 5,
  });

  // 2. Prefetch Instructor Profile/Settings
  const instructorId = userRole === 'student' ? studentData?.user_id : user?.id;
  useQuery({
    queryKey: ['instructor-profile', instructorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", instructorId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!instructorId,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Prefetch Calendar Bookings (for students)
  useQuery({
    queryKey: ['calendar-bookings', studentData?.user_id, format(new Date(), 'yyyy-MM')],
    queryFn: async () => {
      const now = new Date();
      const rangeStart = startOfWeek(startOfMonth(now), { weekStartsOn: 1 }).toISOString();
      const rangeEnd = endOfWeek(endOfMonth(now), { weekStartsOn: 1 }).toISOString();
      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status")
        .eq("user_id", studentData!.user_id)
        .gte("start_time", rangeStart)
        .lte("end_time", rangeEnd)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && userRole === 'student' && !!studentData?.user_id,
    staleTime: 1000 * 60 * 5,
  });

  // 4. Prefetch Schedule Events (for instructors)
  useQuery({
    queryKey: ['schedule-events', user?.id, format(new Date(), 'yyyy-MM')],
    queryFn: async () => {
      const now = new Date();
      const start = startOfMonth(subMonths(now, 1));
      const end = endOfMonth(addMonths(now, 2));
      const { data, error } = await supabase
        .from("bookings")
        .select("id, title, description, start_time, end_time, student_id, status, lesson_type, targets_for_next_session, is_paid, students(name)")
        .eq("user_id", user!.id)
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && userRole === 'instructor',
    staleTime: 1000 * 60 * 5,
  });

  // Auth Guard: Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !session) {
      navigate("/login", { replace: true });
    }
  }, [session, isLoading, navigate]);

  // Subscription Guard: Strictly enforce Pro/Lifetime for instructors
  useEffect(() => {
    if (isLoading || isProfileLoading || !session || !userRole) return;

    const isSubscriptionPage = location.pathname === "/subscription";
    const isSettingsPage = location.pathname === "/settings";
    const isSupportPage = location.pathname === "/support";
    const isInstructor = userRole === 'instructor';
    
    if (isInstructor && !isSubscriptionPage && !isSettingsPage && !isSupportPage) {
      const hasAccess = 
        subscriptionStatus === 'active' || 
        subscriptionStatus === 'lifetime';

      if (!hasAccess) {
        navigate("/subscription", { replace: true });
      }
    }
  }, [subscriptionStatus, userRole, session, isLoading, isProfileLoading, location.pathname, navigate]);

  useEffect(() => {
    const fetchLogo = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("logo_url")
          .eq("id", user.id)
          .single();
        if (data) setLogoUrl(data.logo_url);
      }
    };
    fetchLogo();
  }, [user]);

  if (isLoading) return null;

  const getPageTitle = (pathname: string) => {
    if (pathname === "/") return "Dashboard";
    if (pathname === "/subscription") return "Subscription";
    if (pathname.startsWith("/students/")) return "Student Profile";
    if (pathname === "/students") return "Students";
    if (pathname === "/schedule") return "Schedule";
    if (pathname === "/lessons") return "Lessons";
    if (pathname === "/lesson-notes") return "Lesson Notes";
    if (pathname === "/student-targets") return "Student Targets";
    if (pathname.startsWith("/progress/")) return "Progress Detail";
    if (pathname === "/progress") return "Progress";
    if (pathname === "/progress-report") return "Progress Report";
    if (pathname === "/pupil-self-assessments") return "Self Assessments";
    if (pathname === "/available-slots") return "Available Slots";
    if (pathname === "/driving-test-bookings") return "Test Bookings";
    if (pathname === "/driving-tests") return "Test Records";
    if (pathname === "/test-statistics") return "Test Statistics";
    if (pathname.startsWith("/pre-paid-hours/")) return "Package Details";
    if (pathname === "/pre-paid-hours") return "Pre-Paid Hours";
    if (pathname === "/manage-topics") return "Manage Topics";
    if (pathname === "/admin/topics") return "Default Topics";
    if (pathname === "/admin/instructors") return "All Instructors";
    if (pathname === "/mileage-tracker") return "Mileage Tracker";
    if (pathname === "/accounts") return "Accounts";
    if (pathname === "/support") return "Support";
    if (pathname === "/admin/support") return "Admin Support";
    if (pathname === "/pending-requests") return "Pending Requests";
    if (pathname === "/messages") return "Messages";
    if (pathname === "/settings") return "Settings";
    return "Instructor App";
  };

  const showContentLoader = session && !userRole && isProfileLoading;

  // Check if instructor is restricted
  const isRestrictedInstructor = userRole === 'instructor' && 
    subscriptionStatus !== 'active' && 
    subscriptionStatus !== 'lifetime';

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {isMobile === false && <Sidebar isCollapsed={isCollapsed} logoUrl={logoUrl} />}

      <div className="flex flex-col flex-1">
        {isMobile === false && (
          <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
            <div className="flex items-center gap-4">
              {!isRestrictedInstructor && (
                <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="h-8 w-8">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              )}
              <h2 className="text-lg font-semibold">{getPageTitle(location.pathname)}</h2>
            </div>
            <div className="flex items-center gap-4">
              {!isRestrictedInstructor && (
                <>
                  <BookingRequestAlert />
                  <NotificationBell />
                </>
              )}
            </div>
          </header>
        )}

        {isMobile === true && !isRestrictedInstructor && (
          <div className="sticky top-0 z-[40] flex justify-center p-2 bg-background/80 backdrop-blur-sm border-b">
            <BookingRequestAlert />
          </div>
        )}
        
        <main className={cn("flex-1 overflow-auto p-4 lg:p-6", isMobile ? "pb-32 pt-2" : "pb-6")}>
          {showContentLoader ? (
            <div className="h-full flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Loading Profile...</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        
        <footer className={cn("p-4 text-center text-sm text-gray-500 dark:text-gray-400", isMobile ? "pb-28" : "pb-4")}>
          Driving Instructor App
        </footer>
      </div>
      
      <BottomNav logoUrl={logoUrl} />
      {!isRestrictedInstructor && <AIAssistant />}
    </div>
  );
};

export default Layout;