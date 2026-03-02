"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

interface Booking {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled";
  lesson_type: string;
  student_id: string;
  students: {
    name: string;
  };
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  initialBookings: Booking[] | null;
  isLoadingInitialBookings: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialBookings, setInitialBookings] = useState<Booking[] | null>(null);
  const [isLoadingInitialBookings, setIsLoadingInitialBookings] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialMount = useRef(true);

  const fetchInitialBookings = useCallback(async (userId: string) => {
    if (isLoadingInitialBookings) return;
    setIsLoadingInitialBookings(true);
    const now = new Date();
    const threeMonthsAgo = startOfMonth(addMonths(now, -3));
    const threeMonthsFromNow = endOfMonth(addMonths(now, 3));

    const { data, error } = await supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, student_id, status, lesson_type, students(name)")
      .eq("user_id", userId)
      .gte("start_time", threeMonthsAgo.toISOString())
      .lte("end_time", threeMonthsFromNow.toISOString());

    if (error) {
      console.error("Error fetching initial bookings:", error);
      setInitialBookings([]);
    } else {
      setInitialBookings(data || []);
    }
    setIsLoadingInitialBookings(false);
  }, [isLoadingInitialBookings]);

  useEffect(() => {
    // Initial session check - do this immediately
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          fetchInitialBookings(initialSession.user.id);
          if (location.pathname === "/login") {
            navigate("/", { replace: true });
          }
        } else {
          if (location.pathname !== "/login") {
            navigate("/login", { replace: true });
          }
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isInitialMount.current) {
      getInitialSession();
      isInitialMount.current = false;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          fetchInitialBookings(currentSession.user.id);
        }
        if (location.pathname === "/login") {
          navigate("/", { replace: true });
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setInitialBookings(null);
        if (location.pathname !== "/login") {
          navigate("/login", { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, fetchInitialBookings]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Securing session...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, user, isLoading, initialBookings, isLoadingInitialBookings }}>
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