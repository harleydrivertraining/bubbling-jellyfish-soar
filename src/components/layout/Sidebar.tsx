"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import {
  Car,
  Users,
  Settings,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  NotebookText,
  Target,
  TrendingUp,
  ClipboardCheck,
  Hourglass,
  ListChecks,
  Gauge,
  BarChart3,
  LifeBuoy,
  ShieldCheck,
  PoundSterling,
} from "lucide-react";

interface NavLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  onLinkClick?: () => void;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, label, isCollapsed, onLinkClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "default" : "ghost"}
          className={cn(
            "h-10 w-full justify-start",
            isCollapsed ? "w-10 p-0" : "px-4",
            isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          asChild
        >
          <Link to={to} onClick={onLinkClick}>
            <Icon className={cn("h-5 w-5", isCollapsed ? "" : "mr-3")} />
            {!isCollapsed && label}
          </Link>
        </Button>
      </TooltipTrigger>
      {isCollapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
};

interface SidebarProps {
  isCollapsed: boolean;
  logoUrl: string | null;
  onLinkClick?: () => void;
}

const ICON_MAP: Record<string, any> = {
  dashboard: LayoutDashboard,
  students: Users,
  schedule: CalendarDays,
  lessons: BookOpen,
  "lesson-notes": NotebookText,
  "student-targets": Target,
  progress: TrendingUp,
  "test-bookings": Car,
  "test-records": ClipboardCheck,
  "test-stats": BarChart3,
  "pre-paid": Hourglass,
  mileage: Gauge,
  accounts: PoundSterling,
  topics: ListChecks,
  support: LifeBuoy,
  settings: Settings,
};

const DEFAULT_NAV_ITEMS = [
  { id: "dashboard", to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { id: "students", to: "/students", icon: Users, label: "Students" },
  { id: "schedule", to: "/schedule", icon: CalendarDays, label: "Schedule" },
  { id: "lessons", to: "/lessons", icon: BookOpen, label: "Lessons" },
  { id: "lesson-notes", to: "/lesson-notes", icon: NotebookText, label: "Lesson Notes" },
  { id: "student-targets", to: "/student-targets", icon: Target, label: "Student Targets" },
  { id: "progress", to: "/progress", icon: TrendingUp, label: "Progress" },
  { id: "test-bookings", to: "/driving-test-bookings", icon: Car, label: "Test Bookings" },
  { id: "test-records", to: "/driving-tests", icon: ClipboardCheck, label: "Test Records" },
  { id: "test-stats", to: "/test-statistics", icon: BarChart3, label: "Test Statistics" },
  { id: "pre-paid", to: "/pre-paid-hours", icon: Hourglass, label: "Pre-Paid Hours" },
  { id: "mileage", to: "/mileage-tracker", icon: Gauge, label: "Mileage Tracker" },
  { id: "accounts", to: "/accounts", icon: PoundSterling, label: "Accounts" },
  { id: "topics", to: "/manage-topics", icon: ListChecks, label: "Manage Topics" },
  { id: "support", to: "/support", icon: LifeBuoy, label: "Support" },
  { id: "settings", to: "/settings", icon: Settings, label: "Settings" },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, logoUrl, onLinkClick }) => {
  const { user } = useSession();
  const [isOwner, setIsOwner] = useState(false);
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);

  const loadConfig = useCallback(() => {
    const saved = localStorage.getItem("sidebar_menu_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const visibleItems = parsed
          .filter((p: any) => p.visible)
          .map((p: any) => {
            const original = DEFAULT_NAV_ITEMS.find(d => d.id === p.id);
            return original ? { ...original } : null;
          })
          .filter(Boolean);
        
        // Ensure new items that aren't in the saved config yet are still shown at the end
        const missingItems = DEFAULT_NAV_ITEMS.filter(d => !parsed.find((p: any) => p.id === d.id));
        
        setNavItems([...visibleItems, ...missingItems]);
      } catch (e) {
        console.error("Failed to parse menu config", e);
        setNavItems(DEFAULT_NAV_ITEMS);
      }
    } else {
      setNavItems(DEFAULT_NAV_ITEMS);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    window.addEventListener("sidebar-config-updated", loadConfig);
    return () => window.removeEventListener("sidebar-config-updated", loadConfig);
  }, [loadConfig]);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setIsOwner(data?.role === 'owner');
    };
    checkRole();
  }, [user]);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-sidebar transition-all duration-300",
        isCollapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      <div className="flex h-16 items-center justify-center p-4">
        {logoUrl ? (
          <Avatar className={cn("h-10 w-10", isCollapsed ? "" : "mr-2")}>
            <AvatarImage src={logoUrl} alt="User Logo" />
            <AvatarFallback>
              <Car className="h-6 w-6 text-primary" />
            </AvatarFallback>
          </Avatar>
        ) : (
          <Car className={cn("h-8 w-8 text-primary", isCollapsed ? "" : "mr-2")} />
        )}
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-foreground">HDT App</h1>
        )}
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1 py-4">
        <nav className="grid items-start gap-2 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isCollapsed={isCollapsed}
              onLinkClick={onLinkClick}
            />
          ))}
          
          {isOwner && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              <div className={cn("px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest", isCollapsed && "hidden")}>
                Admin
              </div>
              <NavLink to="/admin/topics" icon={ShieldCheck} label="Default Topics" isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
              <NavLink to="/admin/support" icon={LifeBuoy} label="Support Center" isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
            </>
          )}
        </nav>
      </ScrollArea>
      <Separator className="bg-sidebar-border" />
      <div className="p-4 text-center text-xs text-muted-foreground">
        {!isCollapsed && "© 2025 HDT App"}
      </div>
    </div>
  );
};

export default Sidebar;