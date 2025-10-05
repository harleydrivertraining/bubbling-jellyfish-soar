"use client";

import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileSidebar from "./MobileSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {isMobile ? (
        <MobileSidebar />
      ) : (
        <Sidebar isCollapsed={isCollapsed} />
      )}
      <div className="flex flex-col flex-1">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
          {isMobile ? null : (
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
          )}
          <h2 className="text-lg font-semibold">
            {/* Dynamic header based on route could go here */}
            Driving Instructor App
          </h2>
          <div className="ml-auto flex items-center gap-4">
            {/* User profile/settings could go here */}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Layout;