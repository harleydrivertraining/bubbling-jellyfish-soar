"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { showLoading, dismissToast } from "@/utils/toast";

interface SessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        if (location.pathname !== "/login") {
          navigate("/login");
        }
      } else if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        setIsLoading(false);
        if (location.pathname === "/login") {
          navigate("/"); // Redirect to dashboard after login
        }
      } else {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        if (location.pathname !== "/login") {
          navigate("/login");
        }
      }
    });

    // Initial session check
    const getInitialSession = async () => {
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting initial session:", error);
      }
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
        if (location.pathname === "/login") {
          navigate("/");
        }
      } else {
        if (location.pathname !== "/login") {
          navigate("/login");
        }
      }
      setIsLoading(false);
    };

    getInitialSession();

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  if (isLoading) {
    // You might want a loading spinner here
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading authentication...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, user, isLoading }}>
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