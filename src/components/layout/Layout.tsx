"use client";

import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileMenuButton from "./MobileMenuButton";
import BottomNav from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const Layout = () => {
  const isMobile = useIsMobile();
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

  return (
    <React.Fragment>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Desktop Sidebar */}
        {isMobile === false && <Sidebar isCollapsed={isCollapsed} logoUrl={logoUrl} />}

        <div className="flex flex-col flex-1">
          {/* Header - Desktop Only */}
          {isMobile === false && (
            <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
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
                HDT Instructor App
              </h2>
            </header>
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
            Harley Driver Training
          </footer>
        </div>
        
        {/* Mobile Bottom Navigation */}
        <BottomNav logoUrl={logoUrl} />
      </div>
    </React.Fragment>
  );
};

export default Layout;