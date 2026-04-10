"use client";

import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileMenuButton from "./MobileMenuButton";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import BookingRequestAlert from "@/components/BookingRequestAlert";
import AIAssistant from "@/components/AIAssistant";

const Layout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { user } = useSession();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  useEffect(() => {
    const fetchLogo = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("logo_url")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching logo URL:", error);
          setLogoUrl(null);
        } else if (data) {
          setLogoUrl(data.logo_url);
        }
      } else {
        setLogoUrl(null);
      }
    };

    fetchLogo();
  }, [user]);

  // Helper to get page title based on route
  const getPageTitle = (pathname: string) => {
    if (pathname === "/") return "Dashboard";
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

  return (
    <React.Fragment>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Desktop Sidebar */}
        {isMobile === false && <Sidebar isCollapsed={isCollapsed} logoUrl={logoUrl} />}

        <div className="flex flex-col flex-1">
          {/* Header - Desktop Only */}
          {isMobile === false && (
            <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-8 w-8"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
                <h2 className="text-lg font-semibold">
                  {getPageTitle(location.pathname)}
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                <BookingRequestAlert />
                <NotificationBell />
              </div>
            </header>
          )}

          {/* Mobile Top Alert Bar - Show if mobile or still detecting */}
          {(isMobile === true || isMobile === undefined) && (
            <div className="sticky top-0 z-[40] flex justify-center p-2 bg-background/80 backdrop-blur-sm border-b">
              <BookingRequestAlert />
            </div>
          )}
          
          <main className={cn(
            "flex-1 overflow-auto p-4 lg:p-6",
            isMobile ? "pb-32 pt-2" : "pb-6"
          )}>
            <Outlet />
          </main>
          
          <footer className={cn(
            "p-4 text-center text-sm text-gray-500 dark:text-gray-400",
            isMobile ? "pb-28" : "pb-4"
          )}>
            Driving Instructor App
          </footer>
        </div>
        
        {/* Mobile Bottom Navigation */}
        <BottomNav logoUrl={logoUrl} />

        {/* AI Assistant */}
        <AIAssistant />
      </div>
    </React.Fragment>
  );
};

export default Layout;