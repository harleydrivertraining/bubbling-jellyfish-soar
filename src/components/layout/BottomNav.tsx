"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Menu, Sparkles, Bell, Bot, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import NotificationBell from "@/components/NotificationBell";

interface BottomNavProps {
  logoUrl: string | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ logoUrl }) => {
  const location = useLocation();
  const { user, subscriptionStatus, userRole } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    if (userRole === 'student') {
      setIsStudent(true);
    } else {
      setIsStudent(false);
    }
  }, [userRole]);

  const toggleAssistant = () => {
    window.dispatchEvent(new Event('toggle-instructor-assistant'));
  };

  const navItemClasses = (isActive: boolean) => cn(
    "flex flex-col items-center justify-center flex-1 h-full transition-all duration-200",
    isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
  );

  const labelClasses = "text-[10px] font-bold mt-1 uppercase tracking-tight";

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';
  const isInstructor = userRole === 'instructor';
  const isRestricted = isInstructor && !isSubscribed;

  if (isRestricted) {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t border-border shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.15)] pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          <Link to="/subscription" className={navItemClasses(location.pathname === "/subscription")}>
            <CreditCard className="h-5 w-5" />
            <span className={labelClasses}>Subscribe</span>
          </Link>
          <Link to="/settings" className={navItemClasses(location.pathname === "/settings")}>
            <Bot className="h-5 w-5" />
            <span className={labelClasses}>Account</span>
          </Link>
        </div>
        <div className="h-8 w-full bg-transparent" />
      </div>
    );
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t border-border shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.15)] pb-safe">
      <div className="flex items-center justify-between h-16 px-2">
        {/* Menu Trigger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className={navItemClasses(false)}>
              <Menu className="h-5 w-5" />
              <span className={labelClasses}>Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px]">
            <Sidebar isCollapsed={false} logoUrl={logoUrl} onLinkClick={() => setIsOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Dashboard Link */}
        <Link
          to="/"
          className={navItemClasses(location.pathname === "/")}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className={labelClasses}>Home</span>
        </Link>

        {/* AI Assistant Trigger - Hidden for students */}
        {!isStudent && (
          <button onClick={toggleAssistant} className={navItemClasses(false)}>
            <Sparkles className="h-5 w-5 text-primary" />
            <span className={labelClasses}>AI</span>
          </button>
        )}

        {/* Calendar Link */}
        <Link
          to={isStudent ? "/available-slots" : "/schedule"}
          className={navItemClasses(location.pathname === "/schedule" || location.pathname === "/available-slots")}
        >
          {isStudent ? <Sparkles className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
          <span className={labelClasses}>
            {isStudent ? "Book" : "Calendar"}
          </span>
        </Link>

        {/* Notifications Bell */}
        <div className="flex flex-col items-center justify-center flex-1 h-full">
          <NotificationBell />
          <span className={cn(labelClasses, "text-muted-foreground")}>Alerts</span>
        </div>
      </div>
      <div className="h-8 w-full bg-transparent" />
    </div>
  );
};

export default BottomNav;