"use client";

import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileSidebar from "./MobileSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { useSession } from "@/components/auth/SessionContextProvider"; // Import useSession
import { supabase } from "@/integrations/supabase/client"; // Import supabase client

const Layout = () => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { user } = useSession(); // Get user from session
  const [logoUrl, setLogoUrl] = useState<string | null>(null); // State for logo URL

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
    <> {/* Changed to shorthand fragment */}
      <div className="flex min-h-screen bg-background text-foreground">
        {isMobile ? (
          <MobileSidebar />
        ) : (
          <Sidebar isCollapsed={isCollapsed} logoUrl={logoUrl} /> {/* Pass logoUrl to Sidebar */}
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
    </> {/* Changed to shorthand fragment */}
  );
};

export default Layout;