"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { showLoading, dismissToast } from "@/utils/toast";
import { startOfMonth, endOfMonth, addMonths } from "date-fns"; // Import date-fns utilities

interface Booking { // Define a minimal booking interface for pre-fetching
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
  initialBookings: Booking[] | null; // Add initial bookings
  isLoadingInitialBookings: boolean; // Add loading state for initial bookings
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialBookings, setInitialBookings] = useState<Booking[] | null>(null); // State for initial bookings
  const [isLoadingInitialBookings, setIsLoadingInitialBookings] = useState(true); // State for initial bookings loading
  const navigate = useNavigate();
  const location = useLocation();

  const fetchInitialBookings = useCallback(async (userId: string) => {
    setIsLoadingInitialBookings(true);
    const now = new Date();
    const threeMonthsAgo = startOfMonth(addMonths(now, -3)); // Start 3 months ago
    const threeMonthsFromNow = endOfMonth(addMonths(now, 3)); // End 3 months from now

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
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        setInitialBookings(null); // Clear bookings on sign out
        setIsLoadingInitialBookings(false);
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
        // Fetch initial bookings after user is set
        fetchInitialBookings(currentSession.user.id);
      } else {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        setInitialBookings(null); // Clear bookings if no session
        setIsLoadingInitialBookings(false);
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
        // Fetch initial bookings after user is set
        fetchInitialBookings(initialSession.user.id);
      } else {
        if (location.pathname !== "/login") {
          navigate("/login");
        }
        setIsLoadingInitialBookings(false); // No user, so no bookings to load
      }
      setIsLoading(false);
    };

    getInitialSession();

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, fetchInitialBookings]);


  if (isLoading) {
    // You might want a loading spinner here
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading authentication...</p>
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