"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Menu, Sparkles } from "lucide-react";
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

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-8">
      <div className="flex items-center justify-around h-16">
        {/* Menu Trigger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary transition-colors">
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[240px]">
            <Sidebar isCollapsed={false} logoUrl={logoUrl} onLinkClick={() => setIsOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Dashboard Link */}
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center justify-center w-full h-full transition-colors",
            location.pathname === "/" ? "text-primary" : "text-muted-foreground hover:text-primary"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">Dashboard</span>
        </Link>

        {/* Calendar Link */}
        <Link
          to={isStudent ? "/available-slots" : "/schedule"}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full transition-colors",
            (location.pathname === "/schedule" || location.pathname === "/available-slots") ? "text-primary" : "text-muted-foreground hover:text-primary"
          )}
        >
          {isStudent ? <Sparkles className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
          <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">
            {isStudent ? "Available" : "Calendar"}
          </span>
        </Link>

        {/* Notifications Bell */}
        <div className="flex flex-col items-center justify-center w-full h-full">
          <NotificationBell />
          <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter text-muted-foreground">Alerts</span>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;