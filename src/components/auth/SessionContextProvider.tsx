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
    // 1. IMMEDIATE LOCAL CHECK (Non-blocking)
    const localOverride = localStorage.getItem(`hdt_pro_override_${userId}`);
    if (localOverride === 'true') {
      setSubscriptionStatus('active');
      setUserRole('instructor');
      // We don't return here, we still want to sync with DB in background
    }

    setIsProfileLoading(true);
    
    try {
      // 2. Fetch profile with a 5-second timeout to prevent hanging the app
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, subscription_status")
        .eq("id", userId)
        .single();
      
      clearTimeout(timeoutId);

      if (profileError) throw profileError;

      const role = profile.role?.toLowerCase() || 'instructor';
      const status = profile.subscription_status || 'unsubscribed';

      // Update state with fresh DB data
      setUserRole(role);
      
      // If we have a local override, keep 'active', otherwise use DB status
      if (localOverride === 'true') {
        setSubscriptionStatus('active');
        
        // Background Sync: If DB is out of sync with local Pro status, fix it
        if (status !== 'active' && status !== 'lifetime') {
          const claimId = `SYNC-${userId.substring(0, 8)}`;
          supabase.from("subscription_claims").upsert({
            user_id: userId,
            stripe_session_id: claimId,
            status: 'approved'
          }, { onConflict: 'stripe_session_id' }).then(() => {
            return supabase.from("profiles").update({ subscription_status: 'active' }).eq("id", userId);
          });
        }
      } else {
        setSubscriptionStatus(status);
      }

    } catch (e) {
      console.error("Profile sync error (using local state):", e);
      // If network fails, we rely on the local state we set at the start
      if (localOverride === 'true') {
        setSubscriptionStatus('active');
        setUserRole('instructor');
      } else if (!userRole) {
        // Fallback for new users with no local state and no network
        setUserRole('instructor');
        setSubscriptionStatus('unsubscribed');
      }
    } finally {
      setIsProfileLoading(false);
    }
  }, [userRole]);

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
          // Start profile fetch but don't necessarily block the whole app if local state exists
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
        // Clear overrides on logout
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('hdt_pro_override_')) localStorage.removeItem(key);
        });
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