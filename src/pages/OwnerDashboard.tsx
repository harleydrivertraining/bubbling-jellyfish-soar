"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, MessageSquare, ArrowRight, ShieldCheck, Activity, Clock, AlertCircle, RefreshCw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

interface PlatformStats {
  totalInstructors: number;
  totalStudents: number;
  openSupportRequests: number;
  activeInstructorsThisWeek: number;
}

interface RecentSupport {
  id: string;
  subject: string;
  created_at: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

const OwnerDashboard: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentSupport, setRecentSupport] = useState<RecentSupport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOwnerData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

      // Fetch instructor count
      const { count: instructorCount, error: instructorError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .ilike("role", "instructor");

      if (instructorError) throw instructorError;

      // Fetch active instructors this week (based on updated_at)
      const { count: activeInstructorCount, error: activeError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .ilike("role", "instructor")
        .gte("updated_at", weekStart.toISOString());

      if (activeError) throw activeError;

      // Fetch total students
      const { count: studentCount, error: studentError } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true });

      if (studentError) throw studentError;

      // Fetch open support requests
      const { count: supportCount, error: supportError } = await supabase
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");

      if (supportError) throw supportError;

      // Fetch recent support activity
      const { data: recentSupportData, error: recentSupportError } = await supabase
        .from("support_messages")
        .select("*, profiles(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentSupportError) throw recentSupportError;

      setStats({
        totalInstructors: instructorCount ?? 0,
        totalStudents: studentCount ?? 0,
        openSupportRequests: supportCount ?? 0,
        activeInstructorsThisWeek: activeInstructorCount ?? 0
      });

      setRecentSupport(recentSupportData || []);
    } catch (error: any) {
      console.error("Error fetching owner dashboard data:", error);
      showError("Failed to load platform statistics: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchOwnerData();
  }, [isSessionLoading, fetchOwnerData]);

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-8 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const showRLSWarning = stats && stats.totalInstructors === 0 && stats.totalStudents === 0;

  return (
    <div className="space-y-8 w-full px-4 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Owner Control Panel
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Platform-wide overview and management.</p>
        </div>
        <Button onClick={fetchOwnerData} variant="outline" size="sm" className="font-bold">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
        </Button>
      </div>

      {showRLSWarning && (
        <Card className="bg-amber-50 border-amber-200 text-amber-900">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">No data found?</p>
              <p className="opacity-90">If you expect to see instructors and students here, please ensure your Supabase <strong>Row Level Security (RLS)</strong> policies allow the 'owner' role to view all records in the <code>profiles</code> and <code>students</code> tables.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary Stats Row */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Instructors</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats?.totalInstructors}</div>
            <p className="text-xs text-muted-foreground mt-1">Active teaching accounts</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Students</CardTitle>
            <GraduationCap className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats?.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Learners across all instructors</p>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4 shadow-sm", stats?.openSupportRequests && stats.openSupportRequests > 0 ? "border-l-orange-500 bg-orange-50/30" : "border-l-green-500")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Open Support</CardTitle>
            <MessageSquare className={cn("h-5 w-5", stats?.openSupportRequests && stats.openSupportRequests > 0 ? "text-orange-500" : "text-green-500")} />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats?.openSupportRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">Requests needing attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Active This Week</CardTitle>
            <UserCheck className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats?.activeInstructorsThisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">Instructors logged in or active</p>
          </CardContent>
        </Card>
        
        {/* Placeholder for future stats to maintain grid layout */}
        <div className="md:col-span-2" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="shadow-md border-none overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Support Activity
              </CardTitle>
              <Button asChild variant="secondary" size="sm">
                <Link to="/admin/support">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentSupport.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No recent support requests.</div>
            ) : (
              <div className="divide-y">
                {recentSupport.map((msg) => (
                  <Link 
                    key={msg.id} 
                    to="/admin/support" 
                    className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{msg.subject}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {msg.profiles?.first_name} {msg.profiles?.last_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(msg.created_at), "MMM d, p")}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="p-6 shadow-sm flex flex-col justify-center items-center text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">Platform Management</CardTitle>
            <CardDescription className="mt-2">
              As an owner, you have access to global settings and support tools. 
              Use the sidebar to navigate between instructor support and platform configuration.
            </CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full pt-4">
            <Button asChild variant="outline" className="font-bold">
              <Link to="/admin/support">Support Center</Link>
            </Button>
            <Button asChild variant="outline" className="font-bold">
              <Link to="/settings">Global Settings</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OwnerDashboard;