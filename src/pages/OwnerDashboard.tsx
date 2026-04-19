"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, MessageSquare, ArrowRight, ShieldCheck, Activity, Clock, AlertCircle, RefreshCw, UserCheck, Megaphone, CreditCard, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import GlobalBroadcastForm from "@/components/GlobalBroadcastForm";

interface PlatformStats {
  totalInstructors: number;
  totalStudents: number;
  openSupportRequests: number;
  activeInstructorsThisWeek: number;
}

interface PaymentClaim {
  id: string;
  stripe_session_id: string;
  created_at: string;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

const OwnerDashboard: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [pendingClaims, setPendingClaims] = useState<PaymentClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchOwnerData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

      // Fetch stats
      const [instRes, activeRes, studRes, suppRes, claimsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "instructor"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "instructor").gte("updated_at", weekStart.toISOString()),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("subscription_claims").select("*, profiles(id, first_name, last_name, email)").eq("status", "pending").order("created_at", { ascending: true })
      ]);

      setStats({
        totalInstructors: instRes.count ?? 0,
        totalStudents: studRes.count ?? 0,
        openSupportRequests: suppRes.count ?? 0,
        activeInstructorsThisWeek: activeRes.count ?? 0
      });

      setPendingClaims(claimsRes.data as any || []);
    } catch (error: any) {
      console.error("Error fetching owner dashboard data:", error);
      showError("Failed to load platform statistics.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) fetchOwnerData();
  }, [isSessionLoading, fetchOwnerData]);

  const handleApproveClaim = async (claim: PaymentClaim) => {
    setProcessingId(claim.id);
    try {
      // 1. Update Profile to Active
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ subscription_status: 'active' })
        .eq("id", claim.profiles.id);

      if (profileError) throw profileError;

      // 2. Update Claim to Approved
      await supabase
        .from("subscription_claims")
        .update({ status: 'approved' })
        .eq("id", claim.id);

      // 3. Notify User
      await supabase.from("notifications").insert({
        user_id: claim.profiles.id,
        title: "Account Activated!",
        message: "Your professional subscription has been verified. Welcome to the Pro plan!",
        type: "subscription_activated"
      });

      showSuccess(`Activated ${claim.profiles.first_name}'s account.`);
      fetchOwnerData();
    } catch (err: any) {
      showError("Failed to approve: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClaim = async (id: string) => {
    await supabase.from("subscription_claims").update({ status: 'rejected' }).eq("id", id);
    showSuccess("Claim rejected.");
    fetchOwnerData();
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-8 p-6"><Skeleton className="h-10 w-64" /><div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-32 w-full" /></div></div>;
  }

  return (
    <div className="space-y-8 w-full px-4 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Owner Control Panel
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
            <DialogTrigger asChild>
              <Button className="font-bold"><Megaphone className="mr-2 h-4 w-4" /> Global Broadcast</Button>
            </DialogTrigger>
            <DialogContent><GlobalBroadcastForm onSuccess={() => setIsBroadcastOpen(false)} /></DialogContent>
          </Dialog>
          <Button onClick={fetchOwnerData} variant="outline" size="sm" className="font-bold"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </div>

      {/* Pending Activations Widget */}
      {pendingClaims.length > 0 && (
        <Card className="border-l-4 border-l-orange-500 bg-orange-50/30 shadow-md overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-orange-800">
              <CreditCard className="h-5 w-5 text-orange-600" />
              Pending Activations ({pendingClaims.length})
            </CardTitle>
            <CardDescription className="text-orange-700/70">Instructors waiting for their subscription to be verified.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-orange-100">
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-orange-100/50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-orange-900">{claim.profiles.first_name} {claim.profiles.last_name}</p>
                    <p className="text-xs text-orange-800/70 truncate">{claim.profiles.email}</p>
                    <p className="text-[10px] font-mono text-orange-600 mt-1">Session: {claim.stripe_session_id.substring(0, 20)}...</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 font-bold h-9 px-4"
                      onClick={() => handleApproveClaim(claim)}
                      disabled={processingId === claim.id}
                    >
                      {processingId === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1.5 h-4 w-4" /> Activate</>}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-200 text-red-700 hover:bg-red-50 font-bold h-9"
                      onClick={() => handleRejectClaim(claim.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Link to="/admin/instructors" className="block group">
          <Card className="border-l-4 border-l-primary shadow-sm group-hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Instructors</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black">{stats?.totalInstructors}</div>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Students</CardTitle>
            <GraduationCap className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats?.totalStudents}</div>
          </CardContent>
        </Card>

        <Link to="/admin/support" className="block group">
          <Card className={cn("border-l-4 shadow-sm group-hover:shadow-md transition-all", stats?.openSupportRequests && stats.openSupportRequests > 0 ? "border-l-orange-500 bg-orange-50/30" : "border-l-green-500")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Open Support</CardTitle>
              <MessageSquare className={cn("h-5 w-5", stats?.openSupportRequests && stats.openSupportRequests > 0 ? "text-orange-500" : "text-green-500")} />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black">{stats?.openSupportRequests}</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default OwnerDashboard;