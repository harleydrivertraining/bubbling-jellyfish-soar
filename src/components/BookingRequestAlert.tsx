"use client";

import React, { useState } from "react";
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

  const { data: requests = [] } = useQuery({
    queryKey: ['pending-requests-global', user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user!.id)
        .single();
      
      if (profile?.role?.toLowerCase() !== 'instructor') return [];

      const { data } = await supabase
        .from("bookings")
        .select("id, title, start_time, end_time, student_id, students(name)")
        .eq("user_id", user!.id)
        .eq("status", "pending_approval")
        .order("start_time", { ascending: true });
      
      return (data || []) as any[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleApprove = async (id: string, studentName: string, studentId: string) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "scheduled", title: `${studentName} - Driving lesson` })
      .eq("id", id);
    
    if (error) {
      showError("Failed to approve.");
    } else {
      // Notify student of approval
      if (studentId) {
        await supabase.from("notifications").insert({
          user_id: studentId,
          title: "Booking Approved!",
          message: `Your lesson on ${format(parseISO(requests.find(r => r.id === id).start_time), "PPP")} has been confirmed.`,
          type: "booking_confirmed"
        });
      }

      showSuccess("Booking approved!");
      queryClient.invalidateQueries({ queryKey: ['pending-requests-global'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-bookings'] });
    }
    setProcessingId(null);
  };

  const handleReject = async (id: string, studentId: string, startTime: string) => {
    setProcessingId(id);
    
    // 1. Notify student first while we still have the link
    if (studentId) {
      await supabase.from("notifications").insert({
        user_id: studentId,
        title: "Booking Request Declined",
        message: `Your request for the slot on ${format(parseISO(startTime), "PPP")} was not approved. The slot is now available for others to book.`,
        type: "booking_rejected"
      });
    }

    // 2. Reset the slot
    const { error } = await supabase
      .from("bookings")
      .update({ status: "available", student_id: null, title: "Available Slot" })
      .eq("id", id);
    
    if (error) {
      showError("Failed to reject.");
    } else {
      showSuccess("Booking rejected.");
      queryClient.invalidateQueries({ queryKey: ['pending-requests-global'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
    }
    setProcessingId(null);
  };

  if (requests.length === 0) return null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 transition-all animate-pulse group"
      >
        <BellRing className="h-4 w-4 text-red-600 group-hover:rotate-12 transition-transform" />
        <span className="text-xs sm:text-sm font-black text-red-600 uppercase tracking-tight">
          Booking Request Made ({requests.length})
        </span>
      </button>

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
                      onClick={() => handleApprove(req.id, req.students?.name, req.student_id)}
                      disabled={processingId === req.id}
                    >
                      {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-5 w-5" /> Approve</>}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-red-200 text-red-700 hover:bg-red-50 font-black h-11"
                      onClick={() => handleReject(req.id, req.student_id, req.start_time)}
                      disabled={processingId === req.id}
                    >
                      {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="mr-2 h-5 w-5" /> Deny</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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