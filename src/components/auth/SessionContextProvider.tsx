"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Profile {
  id: string;
  role: string;
  first_name?: string;
  last_name?: string;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();
  const mounted = useRef(true);

  // Check if Supabase is actually configured
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || url.includes("placeholder") || !key || key.includes("placeholder")) {
      setIsConfigured(false);
      setIsLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      
      if (mounted.current) {
        if (error) console.warn("Profile fetch error:", error.message);
        setProfile(data || null);
      }
    } catch (e) {
      console.error("Profile fetch failed:", e);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    
    // Safety valve: Force loading to false after 3 seconds
    const timer = setTimeout(() => {
      if (mounted.current) setIsLoading(false);
    }, 3000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted.current) {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id);
        }
        setIsLoading(false);
        clearTimeout(timer);
      }
    }).catch(() => {
      if (mounted.current) setIsLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (mounted.current) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);
        clearTimeout(timer);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [fetchProfile]);

  // Navigation logic
  useEffect(() => {
    if (isLoading || !isConfigured) return;

    const publicRoutes = ["/login", "/signup"];
    const isPublicRoute = publicRoutes.includes(location.pathname);

    if (!session && !isPublicRoute) {
      navigate("/login", { replace: true });
    } else if (session && isPublicRoute) {
      navigate("/", { replace: true });
    }
  }, [session, isLoading, isConfigured, location.pathname, navigate]);

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="h-16 w-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6">
          <Database className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Database Not Connected</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          To use this application, you need to connect your Supabase project. 
          Please click the <strong>"Add Supabase"</strong> button in the chat interface.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Check Connection Again
        </Button>
      </div>
    );
  }

  const isPublicRoute = ["/login", "/signup"].includes(location.pathname);

  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium">Loading your workspace...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, user, profile, isLoading }}>
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