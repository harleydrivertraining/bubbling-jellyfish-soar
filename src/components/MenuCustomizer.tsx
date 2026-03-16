"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  GripVertical,
  LayoutDashboard,
  Users,
  CalendarDays,
  BookOpen,
  NotebookText,
  Target,
  TrendingUp,
  Car,
  ClipboardCheck,
  BarChart3,
  Hourglass,
  Gauge,
  PoundSterling,
  ListChecks,
  LifeBuoy,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItemConfig {
  id: string;
  label: string;
  visible: boolean;
  to: string;
}

// Define the master list of items with their icons
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

const DEFAULT_MENU: MenuItemConfig[] = [
  { id: "dashboard", label: "Dashboard", visible: true, to: "/" },
  { id: "students", label: "Students", visible: true, to: "/students" },
  { id: "schedule", label: "Schedule", visible: true, to: "/schedule" },
  { id: "lessons", label: "Lessons", visible: true, to: "/lessons" },
  { id: "lesson-notes", label: "Lesson Notes", visible: true, to: "/lesson-notes" },
  { id: "student-targets", label: "Student Targets", visible: true, to: "/student-targets" },
  { id: "progress", label: "Progress", visible: true, to: "/progress" },
  { id: "test-bookings", label: "Test Bookings", visible: true, to: "/driving-test-bookings" },
  { id: "test-records", label: "Test Records", visible: true, to: "/driving-tests" },
  { id: "test-stats", label: "Test Statistics", visible: true, to: "/test-statistics" },
  { id: "pre-paid", label: "Pre-Paid Hours", visible: true, to: "/pre-paid-hours" },
  { id: "mileage", label: "Mileage Tracker", visible: true, to: "/mileage-tracker" },
  { id: "accounts", label: "Accounts", visible: true, to: "/accounts" },
  { id: "topics", label: "Manage Topics", visible: true, to: "/manage-topics" },
  { id: "support", label: "Support", visible: true, to: "/support" },
  { id: "settings", label: "Settings", visible: true, to: "/settings" },
];

const MenuCustomizer: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>(DEFAULT_MENU);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_menu_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with default to ensure new items are added if the app updates
        const merged = parsed.filter((p: any) => DEFAULT_MENU.find(d => d.id === p.id));
        const missing = DEFAULT_MENU.filter(d => !parsed.find((p: any) => p.id === d.id));
        setMenuItems([...merged, ...missing]);
      } catch (e) {
        console.error("Failed to parse menu config", e);
      }
    }
  }, []);

  const saveConfig = (newItems: MenuItemConfig[]) => {
    setMenuItems(newItems);
    localStorage.setItem("sidebar_menu_config", JSON.stringify(newItems));
    // Dispatch a custom event so the Sidebar knows to update
    window.dispatchEvent(new Event("sidebar-config-updated"));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...menuItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newItems.length) {
      [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
      saveConfig(newItems);
    }
  };

  const toggleVisibility = (id: string) => {
    // Don't allow hiding Dashboard or Settings to prevent getting stuck
    if (id === "dashboard" || id === "settings") return;

    const newItems = menuItems.map((item) =>
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    saveConfig(newItems);
  };

  const resetToDefault = () => {
    setMenuItems(DEFAULT_MENU);
    localStorage.removeItem("sidebar_menu_config");
    window.dispatchEvent(new Event("sidebar-config-updated"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Drag or use arrows to reorder. Toggle switches to show/hide pages.
        </p>
        <Button variant="outline" size="sm" onClick={resetToDefault}>
          Reset to Default
        </Button>
      </div>

      <div className="grid gap-2">
        {menuItems.map((item, index) => {
          const Icon = ICON_MAP[item.id] || LayoutDashboard;
          const isFixed = item.id === "dashboard" || item.id === "settings";

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center justify-between p-3 border rounded-lg bg-card transition-all",
                !item.visible && "opacity-60 bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => moveItem(index, "up")}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === menuItems.length - 1}
                    onClick={() => moveItem(index, "down")}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary/70" />
                  <Label className="font-bold text-sm cursor-default">{item.label}</Label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {item.visible ? (
                  <Eye className="h-4 w-4 text-green-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                  checked={item.visible}
                  onCheckedChange={() => toggleVisibility(item.id)}
                  disabled={isFixed}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MenuCustomizer;