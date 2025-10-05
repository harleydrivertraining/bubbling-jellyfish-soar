"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Car,
  Users,
  Settings,
  LayoutDashboard,
  CalendarDays,
  BookOpen,        // New icon for Lessons
  NotebookText,    // New icon for Lesson Notes
  Target,          // New icon for Student Targets
  TrendingUp,      // New icon for Progress
  ClipboardCheck,  // New icon for Driving Tests
  Hourglass,       // New icon for Pre-Paid Hours
  Library,         // New icon for Resources
  ListChecks,      // New icon for Manage Topics
} from "lucide-react";

interface NavLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, label, isCollapsed }) => {
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
          <Link to={to}>
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
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed }) => {
  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/students", icon: Users, label: "Students" },
    { to: "/schedule", icon: CalendarDays, label: "Schedule" },
    { to: "/lessons", icon: BookOpen, label: "Lessons" },
    { to: "/lesson-notes", icon: NotebookText, label: "Lesson Notes" },
    { to: "/student-targets", icon: Target, label: "Student Targets" },
    { to: "/progress", icon: TrendingUp, label: "Progress" },
    { to: "/driving-tests", icon: ClipboardCheck, label: "Driving Tests" },
    { to: "/pre-paid-hours", icon: Hourglass, label: "Pre-Paid Hours" },
    { to: "/resources", icon: Library, label: "Resources" },
    { to: "/manage-topics", icon: ListChecks, label: "Manage Topics" }, // New link
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-sidebar transition-all duration-300",
        isCollapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      <div className="flex h-16 items-center justify-center p-4">
        <Car className={cn("h-8 w-8 text-primary", isCollapsed ? "" : "mr-2")} />
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-foreground">DriveApp</h1>
        )}
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1 py-4">
        <nav className="grid items-start gap-2 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>
      </ScrollArea>
      <Separator className="bg-sidebar-border" />
      <div className="p-4 text-center text-xs text-muted-foreground">
        {!isCollapsed && "© 2024 DriveApp"}
      </div>
    </div>
  );
};

export default Sidebar;