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
  status: "scheduled" | "completed" | "cancelled" | "available";
  lesson_type: string;
  student_id: string;
  is_paid: boolean;
  targets_for_next_session?: string;
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
  refreshInitialBookings: () => Promise<void>;
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
    // Fetch a wide range (3 months either side) to cover most views
    const rangeStart = startOfMonth(addMonths(now, -3));
    const rangeEnd = endOfMonth(addMonths(now, 3));

    const { data, error } = await supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, student_id, status, lesson_type, is_paid, targets_for_next_session, students(name)")
      .eq("user_id", userId)
      .gte("start_time", rangeStart.toISOString())
      .lte("end_time", rangeEnd.toISOString());

    if (error) {
      console.error("Error fetching initial bookings:", error);
      setInitialBookings([]);
    } else {
      setInitialBookings(data as unknown as Booking[] || []);
    }
    setIsLoadingInitialBookings(false);
  }, [isLoadingInitialBookings]);

  const refreshInitialBookings = async () => {
    if (user) {
      await fetchInitialBookings(user.id);
    }
  };

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        const publicRoutes = ["/login", "/signup"];
        const isPublicRoute = publicRoutes.includes(location.pathname);

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          fetchInitialBookings(initialSession.user.id);
          if (isPublicRoute) {
            navigate("/", { replace: true });
          }
        } else {
          if (!isPublicRoute) {
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
      const publicRoutes = ["/login", "/signup"];
      const isPublicRoute = publicRoutes.includes(location.pathname);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          fetchInitialBookings(currentSession.user.id);
        }
        if (isPublicRoute) {
          navigate("/", { replace: true });
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setInitialBookings(null);
        if (!isPublicRoute) {
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
    <SessionContext.Provider value={{ 
      session, 
      user, 
      isLoading, 
      initialBookings, 
      isLoadingInitialBookings,
      refreshInitialBookings
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