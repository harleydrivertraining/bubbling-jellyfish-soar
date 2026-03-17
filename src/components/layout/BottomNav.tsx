"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Menu, Sparkles, Bell } from "lucide-react";
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
  const { user } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setIsStudent(data?.role?.toLowerCase() === 'student');
    };
    checkRole();
  }, [user]);

  const navItemClasses = (isActive: boolean) => cn(
    "flex flex-col items-center justify-center flex-1 h-full transition-all duration-200",
    isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
  );

  const labelClasses = "text-[10px] font-bold mt-1 uppercase tracking-tight";

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.1)] pb-safe">
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
      {/* Extra padding for modern mobile home indicators */}
      <div className="h-6 w-full bg-transparent" />
    </div>
  );
};

export default BottomNav;