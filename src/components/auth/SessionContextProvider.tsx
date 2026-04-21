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
      // 1. Fetch basic profile info
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, subscription_status")
        .eq("id", userId)
        .single();
      
      if (profileError) throw profileError;

      const role = profile.role?.toLowerCase() || 'instructor';
      setUserRole(role);

      let status = profile.subscription_status || 'unsubscribed';

      // 2. If instructor is 'unsubscribed', check for any 'approved' or 'auto_approved' claims
      // This acts as a backup if the profile update was delayed
      if (role === 'instructor' && status === 'unsubscribed') {
        const { data: claims } = await supabase
          .from("subscription_claims")
          .select("status")
          .eq("user_id", userId)
          .in("status", ["approved", "auto_approved"])
          .limit(1);
        
        if (claims && claims.length > 0) {
          status = 'active';
        }
      }

      setSubscriptionStatus(status);
    } catch (e) {
      console.error("Profile fetch error:", e);
      // Fallback defaults
      setUserRole('instructor');
      setSubscriptionStatus('unsubscribed');
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
          fetchProfileData(initialSession.user.id);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
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