"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  const initializationStarted = useRef(false);

  const fetchProfileData = useCallback(async (userId: string) => {
    try {
      // We use a timeout for the profile fetch so it doesn't hang the whole app
      const profilePromise = supabase
        .from("profiles")
        .select("role, subscription_status")
        .eq("id", userId)
        .single();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Profile fetch timeout")), 3000)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;
      
      if (!error && data) {
        setUserRole(data.role?.toLowerCase() || 'instructor');
        setSubscriptionStatus(data.subscription_status || 'trialing');
      } else {
        // Default to instructor/trialing if profile is missing or error occurs
        setUserRole('instructor');
        setSubscriptionStatus('trialing');
      }
    } catch (e) {
      console.warn("Profile fetch failed or timed out, using defaults:", e);
      setUserRole('instructor');
      setSubscriptionStatus('trialing');
    }
  }, []);

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    let mounted = true;

    const initialize = async () => {
      // Safety timeout: If we're still "loading" after 6 seconds, force the app to show something
      const forceLoadTimeout = setTimeout(() => {
        if (mounted && isLoading) {
          console.warn("Session initialization taking too long, forcing load state.");
          setIsLoading(false);
        }
      }, 6000);

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchProfileData(initialSession.user.id);
          }
          clearTimeout(forceLoadTimeout);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Initialization error:", error);
        if (mounted) {
          clearTimeout(forceLoadTimeout);
          setIsLoading(false);
        }
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
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Securing Session...</p>
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