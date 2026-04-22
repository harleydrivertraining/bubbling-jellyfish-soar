"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ShieldCheck, Zap, Ban, Loader2, Infinity, Clock, CalendarDays } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import { format, parseISO } from "date-fns";

interface EditInstructorSubscriptionProps {
  instructorId: string;
  instructorName: string;
  currentStatus: string | null;
  currentExpiry: string | null;
  onSuccess: () => void;
}

const EditInstructorSubscription: React.FC<EditInstructorSubscriptionProps> = ({
  instructorId,
  instructorName,
  currentStatus,
  currentExpiry,
  onSuccess,
}) => {
  const [status, setStatus] = useState<string>(currentStatus || "unsubscribed");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    currentExpiry ? parseISO(currentExpiry) : undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ 
          subscription_status: status,
          subscription_expiry: expiryDate ? format(expiryDate, "yyyy-MM-dd") : null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", instructorId)
        .select();

      if (error) throw error;

      showSuccess(`Subscription updated for ${instructorName}`);
      onSuccess();
    } catch (error: any) {
      console.error("Update error:", error);
      showError(error.message || "Failed to update subscription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase text-muted-foreground">Subscription Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full h-12 font-bold">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active" className="py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="font-bold">Active (Pro)</span>
              </div>
            </SelectItem>
            <SelectItem value="lifetime" className="py-3">
              <div className="flex items-center gap-2">
                <Infinity className="h-4 w-4 text-blue-600" />
                <span className="font-bold">Lifetime Access</span>
              </div>
            </SelectItem>
            <SelectItem value="unsubscribed" className="py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="font-bold">Unsubscribed</span>
              </div>
            </SelectItem>
            <SelectItem value="inactive" className="py-3">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                <span className="font-bold">Inactive / Cancelled</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5" />
          Subscription Expiry Date
        </Label>
        <DatePicker 
          date={expiryDate} 
          setDate={setExpiryDate} 
          placeholder="No expiry set"
        />
        <p className="text-[10px] text-muted-foreground italic">
          Leave blank for Lifetime or Unsubscribed accounts.
        </p>
      </div>

      <div className="bg-muted/50 p-4 rounded-xl text-[11px] text-muted-foreground space-y-2 border">
        <p><strong>Active:</strong> Full access to all professional features.</p>
        <p><strong>Expiry Date:</strong> Used to track when manual payments or trials end.</p>
      </div>

      <Button 
        onClick={handleUpdate} 
        className="w-full font-bold h-12 text-lg" 
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Updating...
          </>
        ) : (
          "Save Subscription Details"
        )}
      </Button>
    </div>
  );
};

export default EditInstructorSubscription;