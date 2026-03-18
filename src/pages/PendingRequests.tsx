"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { BellRing, Check, X, Clock, Calendar, User, Loader2, ArrowLeft, Inbox, RefreshCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { showSuccess, showError } from "@/utils/toast";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PendingRequests: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: requests = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['pending-requests-page', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("bookings")
        .select("id, title, start_time, end_time, student_id, students(name, auth_user_id)")
        .eq("user_id", user.id)
        .eq("status", "pending_approval")
        .order("start_time", { ascending: true });
      
      if (error) {
        console.error("Error fetching pending requests:", error);
        throw error;
      }
      
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  // Real-time subscription to catch new requests immediately
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('pending-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Invalidate both the page query and the global alert query
          queryClient.invalidateQueries({ queryKey: ['pending-requests-page'] });
          queryClient.invalidateQueries({ queryKey: ['pending-requests-global'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const handleApprove = async (id: string, studentName: string, authUserId: string | null) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "scheduled", title: `${studentName} - Driving lesson` })
      .eq("id", id);
    
    if (error) {
      showError("Failed to approve.");
    } else {
      if (authUserId) {
        const req = requests.find(r => r.id === id);
        await supabase.from("notifications").insert({
          user_id: authUserId,
          title: "Booking Approved!",
          message: `Your lesson on ${format(parseISO(req.start_time), "PPP")} has been confirmed.`,
          type: "booking_confirmed"
        });
      }

      showSuccess("Booking approved!");
      queryClient.invalidateQueries({ queryKey: ['pending-requests-page'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests-global'] });
    }
    setProcessingId(null);
  };

  const handleReject = async (id: string, authUserId: string | null, startTime: string) => {
    setProcessingId(id);
    
    if (authUserId) {
      await supabase.from("notifications").insert({
        user_id: authUserId,
        title: "Booking Request Declined",
        message: `Your request for the slot on ${format(parseISO(startTime), "PPP")} was not approved.`,
        type: "booking_rejected"
      });
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "available", student_id: null, title: "Available Slot" })
      .eq("id", id);
    
    if (error) {
      showError("Failed to reject.");
    } else {
      showSuccess("Booking rejected.");
      queryClient.invalidateQueries({ queryKey: ['pending-requests-page'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests-global'] });
    }
    setProcessingId(null);
  };

  if (isSessionLoading || (isLoading && !isFetching)) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="-ml-2">
            <Link to="/schedule">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Booking Requests</h1>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isFetching}
          className="font-bold"
        >
          <RefreshCcw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center border-dashed bg-muted/10">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">No pending requests</h2>
          <p className="text-muted-foreground mt-1">When students request available slots, they will appear here.</p>
          <Button asChild variant="outline" className="mt-6 font-bold">
            <Link to="/schedule">Return to Calendar</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <Card key={req.id} className="overflow-hidden border-l-4 border-l-orange-500 shadow-md">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-black text-xl truncate">{req.students?.name || "Unknown Student"}</p>
                        <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Requested Lesson</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 pl-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary/60" />
                        {format(parseISO(req.start_time), "EEEE, MMMM do")}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary/60" />
                        {format(parseISO(req.start_time), "p")} — {format(parseISO(req.end_time), "p")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Button 
                      variant="outline" 
                      className="flex-1 md:flex-none border-red-200 text-red-700 hover:bg-red-50 font-black h-12 px-6"
                      onClick={() => handleReject(req.id, req.students?.auth_user_id, req.start_time)}
                      disabled={processingId === req.id}
                    >
                      {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="mr-2 h-5 w-5" /> Decline</>}
                    </Button>
                    <Button 
                      className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 font-black h-12 px-8"
                      onClick={() => handleApprove(req.id, req.students?.name, req.students?.auth_user_id)}
                      disabled={processingId === req.id}
                    >
                      {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-5 w-5" /> Approve</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingRequests;