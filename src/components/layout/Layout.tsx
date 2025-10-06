"use client";

import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileMenuButton from "./MobileMenuButton"; // New import
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

const Layout = () => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { user } = useSession();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Fetch logo URL when user is available
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
        setLogoUrl(null); // Clear logo if user logs out
      }
    };

    fetchLogo();
  }, [user]); // Re-fetch when user changes

  return (
    <React.Fragment>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Render desktop sidebar if not mobile */}
        {isMobile === false && <Sidebar isCollapsed={isCollapsed} logoUrl={logoUrl} />}

        <div className="flex flex-col flex-1">
          <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
            {isMobile ? (
              // Render mobile menu button here
              <MobileMenuButton logoUrl={logoUrl} />
            ) : (
              // Render desktop toggle button here
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
              HDT Instructor App
            </h2>
            <div className="ml-auto flex items-center gap-4">
              {/* User profile/settings could go here */}
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
          <footer className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Harley Driver Training
          </footer>
        </div>
      </div>
    </React.Fragment>
  );
};

export default Layout;