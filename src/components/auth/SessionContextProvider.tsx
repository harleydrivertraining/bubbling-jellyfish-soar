"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  const isInitialMount = useRef(true);

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
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }, []);

  // Initial session check
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchProfileData(initialSession.user.id);
        }
      } catch (error) {
        console.error("Session init error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
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
      subscription.unsubscribe();
    };
  }, [fetchProfileData]);

  // Navigation Guard
  useEffect(() => {
    if (isLoading) return;

    const publicRoutes = ["/login", "/74985", "/signup-success", "/forgot-password", "/reset-password"];
    const isPublicRoute = publicRoutes.includes(location.pathname);

    if (!session && !isPublicRoute) {
      navigate("/login", { replace: true });
    } else if (session && isPublicRoute) {
      navigate("/", { replace: true });
    }
  }, [session, isLoading, location.pathname, navigate]);

  // Real-time profile listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new) {
            setSubscriptionStatus(payload.new.subscription_status);
            setUserRole(payload.new.role?.toLowerCase() || 'instructor');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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