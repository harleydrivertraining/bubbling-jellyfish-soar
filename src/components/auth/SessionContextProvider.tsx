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
      // 1. Fetch profile from DB
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, subscription_status")
        .eq("id", userId)
        .single();
      
      if (profileError) throw profileError;

      const role = profile.role?.toLowerCase() || 'instructor';
      const status = profile.subscription_status || 'unsubscribed';

      // 2. Update state with fresh DB data
      setUserRole(role);
      setSubscriptionStatus(status);

      // 3. Sync local storage hint (only for UI speed on next boot)
      if (status === 'active' || status === 'lifetime') {
        localStorage.setItem(`hdt_pro_override_${userId}`, 'true');
      } else {
        localStorage.removeItem(`hdt_pro_override_${userId}`);
      }

    } catch (e) {
      console.error("Profile sync error:", e);
      
      // Fallback to local hint ONLY if network fails
      const localOverride = localStorage.getItem(`hdt_pro_override_${userId}`);
      if (localOverride === 'true' && !subscriptionStatus) {
        setSubscriptionStatus('active');
        setUserRole('instructor');
      }
    } finally {
      setIsProfileLoading(false);
    }
  }, [subscriptionStatus]);

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
          
          // Initial fast-path for UI (prevents flicker)
          const localOverride = localStorage.getItem(`hdt_pro_override_${initialSession.user.id}`);
          if (localOverride === 'true') {
            setSubscriptionStatus('active');
            setUserRole('instructor');
          }

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

  // REAL-TIME SUBSCRIPTION SYNC
  // This ensures that if an owner changes a user's status, the user's app reacts instantly
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-status-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const newStatus = payload.new.subscription_status;
          const newRole = payload.new.role;
          
          setSubscriptionStatus(newStatus);
          setUserRole(newRole);

          if (newStatus === 'active' || newStatus === 'lifetime') {
            localStorage.setItem(`hdt_pro_override_${user.id}`, 'true');
          } else {
            localStorage.removeItem(`hdt_pro_override_${user.id}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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