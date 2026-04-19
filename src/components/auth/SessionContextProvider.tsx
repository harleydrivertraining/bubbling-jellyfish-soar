"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

interface SessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  subscriptionStatus: string | null;
  userRole: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();

  const fetchProfileData = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, subscription_status")
        .eq("id", userId)
        .single();
      
      if (!error && data) {
        setUserRole(data.role?.toLowerCase() || 'instructor');
        setSubscriptionStatus(data.subscription_status || 'trialing');
      } else {
        // Fallback for new users or missing profiles
        setUserRole('instructor');
        setSubscriptionStatus('trialing');
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Safety timeout: If session doesn't load in 5 seconds, clear the loading state
    const timer = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn("Session initialization timed out. Clearing loading state.");
        setIsLoading(false);
      }
    }, 5000);

    const initialize = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchProfileData(initialSession.user.id);
          }
          setIsLoading(false);
          clearTimeout(timer);
        }
      } catch (error) {
        console.error("Initialization error:", error);
        if (mounted) setIsLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession?.user) {
          await fetchProfileData(currentSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setSubscriptionStatus(null);
        setUserRole(null);
        // Force redirect to login on sign out
        navigate("/login", { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [fetchProfileData, navigate]);

  // Navigation Guard - Only runs when loading is finished
  useEffect(() => {
    if (isLoading) return;

    const publicRoutes = ["/login", "/74985", "/signup-success", "/forgot-password", "/reset-password"];
    const isPublicRoute = publicRoutes.includes(location.pathname);

    if (!session && !isPublicRoute) {
      console.log("No session found, redirecting to login");
      navigate("/login", { replace: true });
    } else if (session && isPublicRoute) {
      console.log("Session found on public route, redirecting to home");
      navigate("/", { replace: true });
    }
  }, [session, isLoading, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Securing session...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ 
      session, 
      user, 
      isLoading, 
      subscriptionStatus,
      userRole
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionContextProvider");
  }
  return context;
};