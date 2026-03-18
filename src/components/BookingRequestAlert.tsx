"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { BellRing, Check, X, Clock, Calendar, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showSuccess, showError } from "@/utils/toast";

const BookingRequestAlert: React.FC = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: requests = [], refetch } = useQuery({
    queryKey: ['pending-requests-global', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      if (profile?.role?.toLowerCase() !== 'instructor') return [];

      const { data } = await supabase
        .from("bookings")
        .select("id, title, start_time, end_time, student_id, students(name, auth_user_id)")
        .eq("user_id", user.id)
        .eq("status", "pending_approval")
        .order("start_time", { ascending: true });
      
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  // Listen for global trigger to open this dialog
  useEffect(() => {
    const handleOpenTrigger = () => {
      // Force a refetch to ensure the new request is in the list
      refetch();
      setIsOpen(true);
    };
    
    window.addEventListener("hdt-open-booking-requests", handleOpenTrigger);
    return () => window.removeEventListener("hdt-open-booking-requests", handleOpenTrigger);
  }, [refetch]);

  // Real-time subscription for new requests
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('schema-db-changes-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`
        },
        () => {
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
      queryClient.invalidateQueries({ queryKey: ['pending-requests-global'] });
    }
    setProcessingId(null);
  };

  // We always render the Dialog so the listener stays active, 
  // but we only show the trigger button if there are requests.
  return (
    <>
      {requests.length > 0 && (
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 transition-all animate-pulse group"
        >
          <BellRing className="h-4 w-4 text-red-600 group-hover:rotate-12 transition-transform" />
          <span className="text-xs sm:text-sm font-black text-red-600 uppercase tracking-tight">
            New Request ({requests.length})
          </span>
        </button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-red-600 text-white">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <BellRing className="h-6 w-6" />
              Pending Booking Requests
            </DialogTitle>
            <DialogDescription className="text-red-100 font-medium">
              Review and manage lesson requests from your students.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {requests.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Check className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-bold text-lg">All caught up!</p>
                <p className="text-sm text-muted-foreground">No pending requests at the moment.</p>
              </div>
            ) : (
              <div className="divide-y">
                {requests.map((req) => (
                  <div key={req.id} className="p-6 space-y-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <p className="font-black text-lg truncate">{req.students?.name || "Unknown Student"}</p>
                        </div>
                        <div className="flex flex-col gap-1 pl-10">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground font-bold">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(parseISO(req.start_time), "EEEE, MMMM do")}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            {format(parseISO(req.start_time), "p")} — {format(parseISO(req.end_time), "p")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700 font-black h-11"
                        onClick={() => handleApprove(req.id, req.students?.name, req.students?.auth_user_id)}
                        disabled={processingId === req.id}
                      >
                        {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-5 w-5" /> Approve</>}
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 border-red-200 text-red-700 hover:bg-red-50 font-black h-11"
                        onClick={() => handleReject(req.id, req.students?.auth_user_id, req.start_time)}
                        disabled={processingId === req.id}
                      >
                        {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="mr-2 h-5 w-5" /> Deny</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 bg-muted/30 border-t text-center">
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="font-bold text-muted-foreground">
              Close Window
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BookingRequestAlert;