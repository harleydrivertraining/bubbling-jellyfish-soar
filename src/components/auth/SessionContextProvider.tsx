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

interface Profile {
  id: string;
  role: string;
  first_name?: string;
  last_name?: string;
  instructor_pin?: string;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  initialBookings: Booking[] | null;
  isLoadingInitialBookings: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialBookings, setInitialBookings] = useState<Booking[] | null>(null);
  const [isLoadingInitialBookings, setIsLoadingInitialBookings] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialMount = useRef(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    if (!error) setProfile(data);
    return data;
  }, []);

  const fetchInitialBookings = useCallback(async (userId: string, role: string) => {
    if (isLoadingInitialBookings) return;
    setIsLoadingInitialBookings(true);
    const now = new Date();
    const threeMonthsAgo = startOfMonth(addMonths(now, -3));
    const threeMonthsFromNow = endOfMonth(addMonths(now, 3));

    let query = supabase
      .from("bookings")
      .select("id, title, description, start_time, end_time, student_id, status, lesson_type, students(name)")
      .gte("start_time", threeMonthsAgo.toISOString())
      .lte("end_time", threeMonthsFromNow.toISOString());

    if (role === 'student') {
      // For students, we need to find their student record ID first
      const { data: studentRec } = await supabase.from("students").select("id").eq("auth_user_id", userId).single();
      if (studentRec) {
        query = query.eq("student_id", studentRec.id);
      } else {
        setInitialBookings([]);
        setIsLoadingInitialBookings(false);
        return;
      }
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching initial bookings:", error);
      setInitialBookings([]);
    } else {
      setInitialBookings(data || []);
    }
    setIsLoadingInitialBookings(false);
  }, [isLoadingInitialBookings]);

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        const publicRoutes = ["/login", "/signup"];
        const isPublicRoute = publicRoutes.includes(location.pathname);

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          const prof = await fetchProfile(initialSession.user.id);
          if (prof) {
            fetchInitialBookings(initialSession.user.id, prof.role);
          }
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
          const prof = await fetchProfile(currentSession.user.id);
          if (prof) fetchInitialBookings(currentSession.user.id, prof.role);
        }
        if (isPublicRoute) {
          navigate("/", { replace: true });
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setInitialBookings(null);
        if (!isPublicRoute) {
          navigate("/login", { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, fetchProfile, fetchInitialBookings]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium animate-pulse">Securing session...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, user, profile, isLoading, initialBookings, isLoadingInitialBookings }}>
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