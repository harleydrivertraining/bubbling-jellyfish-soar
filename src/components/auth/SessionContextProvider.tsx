"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface SessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  subscriptionStatus: string | null;
  userRole: string | null;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const initializationStarted = useRef(false);

  const fetchProfileData = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, subscription_status")
        .eq("id", userId)
        .single();
      
      if (!error && data) {
        setUserRole(data.role?.toLowerCase() || 'instructor');
        
        // OPTIMISTIC CHECK: If we are returning from PayPal, force 'active' status
        // even if the database hasn't updated yet. This prevents the "stuck" loading screen.
        const urlParams = new URLSearchParams(window.location.search);
        const hasPaypalReturn = urlParams.get("subscription_id") || urlParams.get("token") || urlParams.get("PayerID");
        
        if (hasPaypalReturn && data.role?.toLowerCase() === 'instructor') {
          setSubscriptionStatus('active');
        } else {
          setSubscriptionStatus(data.subscription_status || 'unsubscribed');
        }
      }
    } catch (e) {
      console.warn("Background profile fetch failed:", e);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfileData(user.id);
  }, [user, fetchProfileData]);

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    const initialize = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchProfileData(initialSession.user.id);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Auth init error:", error);
        setIsLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession?.user) {
          fetchProfileData(currentSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setSubscriptionStatus(null);
        setUserRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfileData]);

  return (
    <SessionContext.Provider value={{ 
      session, 
      user, 
      isLoading, 
      isProfileLoading,
      subscriptionStatus,
      userRole,
      refreshProfile
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export default SessionContextProvider;

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionContextProvider");
  }
  return context;
};