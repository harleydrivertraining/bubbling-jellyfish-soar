"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  LogOut,
  UserCircle,
  Sparkles,
  Inbox,
  MessageSquare,
  ListTodo,
  CreditCard
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
  const isActive = location.pathname === to || (to === "/" && location.search.includes("tab="));

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

const DEFAULT_NAV_ITEMS = [
  { id: "dashboard", to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { id: "schedule", to: "/schedule", icon: CalendarDays, label: "Schedule" },
  { id: "todo", to: "/todo", icon: ListTodo, label: "To Do List" },
  { id: "students", to: "/students", icon: Users, label: "Students" },
  { id: "messages", to: "/messages", icon: MessageSquare, label: "Messages" },
  { id: "lessons", to: "/lessons", icon: BookOpen, label: "Lessons" },
  { id: "lesson-notes", to: "/lesson-notes", icon: NotebookText, label: "Lesson Notes" },
  { id: "student-targets", to: "/student-targets", icon: Target, label: "Student Targets" },
  { id: "progress", to: "/progress", icon: TrendingUp, label: "Progress" },
  { id: "self-assessments", to: "/pupil-self-assessments", icon: UserCircle, label: "Pupil Self-Assessments" },
  { id: "test-bookings", to: "/driving-test-bookings", icon: Car, label: "Test Bookings" },
  { id: "test-records", to: "/driving-tests", icon: ClipboardCheck, label: "Test Records" },
  { id: "test-stats", to: "/test-statistics", icon: BarChart3, label: "Test Statistics" },
  { id: "pre-paid", to: "/pre-paid-hours", icon: Hourglass, label: "Pre-Paid Hours" },
  { id: "mileage", to: "/mileage-tracker", icon: Gauge, label: "Mileage Tracker" },
  { id: "accounts", to: "/accounts", icon: PoundSterling, label: "Accounts" },
  { id: "topics", to: "/manage-topics", icon: ListChecks, label: "Manage Topics" },
  { id: "subscription", to: "/subscription", icon: CreditCard, label: "Subscription" },
  { id: "support", to: "/support", icon: LifeBuoy, label: "Support" },
  { id: "settings", to: "/settings", icon: Settings, label: "Settings" },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, logoUrl, onLinkClick }) => {
  const { user, subscriptionStatus, userRole } = useSession();
  const navigate = useNavigate();
  const [isOwner, setIsOwner] = useState(false);
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/login";
    }
  };

  const loadConfig = useCallback(() => {
    const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime' || subscriptionStatus === 'trialing';
    const isInstructor = userRole === 'instructor';

    if (isInstructor && !isSubscribed) {
      setNavItems([
        { id: "subscription", to: "/subscription", icon: CreditCard, label: "Subscription" },
        { id: "settings", to: "/settings", icon: Settings, label: "Settings" },
      ]);
      return;
    }

    if (userRole === 'student') {
      setNavItems([
        { id: "dashboard", to: "/", icon: LayoutDashboard, label: "Dashboard" },
        { id: "messages", to: "/?tab=messages", icon: Inbox, label: "Messages" },
        { id: "available-slots", to: "/available-slots", icon: Sparkles, label: "Available Slots" },
        { id: "progress-report", to: "/progress-report", icon: TrendingUp, label: "Progress Report" },
        { id: "support", to: "/support", icon: LifeBuoy, label: "Support" },
        { id: "settings", to: "/settings", icon: Settings, label: "Settings" },
      ]);
      return;
    }

    let items = [...DEFAULT_NAV_ITEMS];
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
        
        const missingItems = DEFAULT_NAV_ITEMS.filter(d => !parsed.find((p: any) => p.id === d.id));
        items = [...visibleItems, ...missingItems];
      } catch (e) {
        console.error("Failed to parse menu config", e);
      }
    }

    setNavItems(items);
  }, [userRole, subscriptionStatus]);

  useEffect(() => {
    loadConfig();
    window.addEventListener("sidebar-config-updated", loadConfig);
    return () => window.removeEventListener("sidebar-config-updated", loadConfig);
  }, [loadConfig]);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = data?.role?.toLowerCase() || null;
      setIsOwner(role === 'owner');
    };
    checkRole();
  }, [user]);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-sidebar transition-all duration-300",
        isCollapsed ? "w-[60px]" : "w-full md:w-[240px]"
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
          <h1 className="text-xl font-bold text-foreground">Instructor App</h1>
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
              <NavLink to="/admin/instructors" icon={Users} label="All Instructors" isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
              <NavLink to="/admin/topics" icon={ShieldCheck} label="Default Topics" isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
              <NavLink to="/admin/support" icon={LifeBuoy} label="Support Center" isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
            </>
          )}
        </nav>
      </ScrollArea>
      
      <Separator className="bg-sidebar-border" />
      <div className="p-2">
        <Button
          variant="ghost"
          className={cn(
            "h-10 w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10",
            isCollapsed ? "w-10 p-0 justify-center" : "px-4"
          )}
          onClick={handleLogout}
        >
          <LogOut className={cn("h-5 w-5", isCollapsed ? "" : "mr-3")} />
          {!isCollapsed && "Logout"}
        </Button>
      </div>
      
      <Separator className="bg-sidebar-border" />
      <div className="p-4 text-center text-xs text-muted-foreground">
        {!isCollapsed && "© 2025 Driving Instructor App"}
      </div>
    </div>
  );
};

export default Sidebar;