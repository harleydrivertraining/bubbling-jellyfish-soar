"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, MessageSquare, ArrowRight, ShieldCheck, Activity, Clock, AlertCircle, RefreshCw, UserCheck, Megaphone, CreditCard, Check, X, Loader2, Inbox, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import GlobalBroadcastForm from "@/components/GlobalBroadcastForm";
import { Badge } from "@/components/ui/badge";

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
  user_id: string;
  status: string;
  profiles?: {
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

      const [instRes, activeRes, studRes, suppRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "instructor"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "instructor").gte("updated_at", weekStart.toISOString()),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open")
      ]);

      setStats({
        totalInstructors: instRes.count ?? 0,
        totalStudents: studRes.count ?? 0,
        openSupportRequests: suppRes.count ?? 0,
        activeInstructorsThisWeek: activeRes.count ?? 0
      });

      const { data: claimsData, error: claimsError } = await supabase
        .from("subscription_claims")
        .select("*")
        .in("status", ["pending", "auto_approved"])
        .order("created_at", { ascending: false });

      if (claimsError) throw claimsError;

      if (claimsData && claimsData.length > 0) {
        const userIds = Array.from(new Set(claimsData.map(c => c.user_id)));
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds);

        const profileMap = new Map(profilesData?.map(p => [p.id, p]));
        const mergedClaims = claimsData.map(claim => ({
          ...claim,
          profiles: profileMap.get(claim.user_id)
        }));

        setPendingClaims(mergedClaims);
      } else {
        setPendingClaims([]);
      }

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

  const handleVerifyClaim = async (claim: PaymentClaim) => {
    setProcessingId(claim.id);
    try {
      await supabase
        .from("subscription_claims")
        .update({ status: 'approved' })
        .eq("id", claim.id);

      showSuccess(`Verified activation for ${claim.profiles?.first_name || 'Instructor'}.`);
      fetchOwnerData();
    } catch (err: any) {
      showError("Failed to verify: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevokeAccess = async (claim: PaymentClaim) => {
    setProcessingId(claim.id);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ subscription_status: 'inactive' })
        .eq("id", claim.user_id);

      if (profileError) throw profileError;

      await supabase
        .from("subscription_claims")
        .update({ status: 'rejected' })
        .eq("id", claim.id);

      await supabase.from("notifications").insert({
        user_id: claim.user_id,
        title: "Subscription Revoked",
        message: "Your Pro access has been revoked as we could not verify your payment. Please contact support.",
        type: "subscription_revoked"
      });

      showSuccess(`Revoked access for ${claim.profiles?.first_name || 'Instructor'}.`);
      fetchOwnerData();
    } catch (err: any) {
      showError("Failed to revoke: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-8 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
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

      <Card className={cn(
        "border-l-4 shadow-md overflow-hidden transition-all",
        pendingClaims.length > 0 ? "border-l-orange-500 bg-orange-50/30" : "border-l-muted bg-muted/5"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <CreditCard className={cn("h-5 w-5", pendingClaims.length > 0 ? "text-orange-600" : "text-muted-foreground")} />
            Recent Activations ({pendingClaims.length})
          </CardTitle>
          <CardDescription>Verify Order IDs for instructors who activated their own accounts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pendingClaims.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground italic text-sm flex items-center justify-center gap-2">
              <Inbox className="h-4 w-4" /> No recent activations to verify.
            </div>
          ) : (
            <div className="divide-y divide-orange-100">
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-orange-100/50 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-orange-900">
                        {claim.profiles?.first_name} {claim.profiles?.last_name || 'Unknown Instructor'}
                      </p>
                      {claim.status === 'auto_approved' && (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[9px] font-black uppercase">Auto-Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-orange-800/70 truncate">{claim.profiles?.email}</p>
                    <p className="text-[10px] font-mono text-orange-600 mt-1">Order ID: {claim.stripe_session_id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 font-bold h-9 px-4"
                      onClick={() => handleVerifyClaim(claim)}
                      disabled={processingId === claim.id}
                    >
                      {processingId === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1.5 h-4 w-4" /> Verify</>}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-200 text-red-700 hover:bg-red-50 font-bold h-9"
                      onClick={() => handleRevokeAccess(claim)}
                      disabled={processingId === claim.id}
                    >
                      {processingId === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Ban className="mr-1.5 h-4 w-4" /> Revoke</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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