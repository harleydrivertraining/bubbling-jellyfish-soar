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
import { ShieldCheck, Zap, Ban, Loader2, Infinity } from "lucide-react";

interface EditInstructorSubscriptionProps {
  instructorId: string;
  instructorName: string;
  currentStatus: string | null;
  onSuccess: () => void;
}

const EditInstructorSubscription: React.FC<EditInstructorSubscriptionProps> = ({
  instructorId,
  instructorName,
  currentStatus,
  onSuccess,
}) => {
  const [status, setStatus] = useState<string>(currentStatus || "inactive");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: status })
        .eq("id", instructorId);

      if (error) throw error;

      showSuccess(`Subscription updated for ${instructorName}`);
      onSuccess();
    } catch (error: any) {
      console.error("Update error:", error);
      showError("Failed to update subscription: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label>Subscription Status for {instructorName}</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full h-12 font-bold">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active" className="py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" />
                <span>Active (Monthly)</span>
              </div>
            </SelectItem>
            <SelectItem value="lifetime" className="py-3">
              <div className="flex items-center gap-2">
                <Infinity className="h-4 w-4 text-blue-600" />
                <span>Lifetime Access</span>
              </div>
            </SelectItem>
            <SelectItem value="trialing" className="py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-orange-600" />
                <span>Trialing</span>
              </div>
            </SelectItem>
            <SelectItem value="inactive" className="py-3">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                <span>Inactive / Cancelled</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg text-xs text-muted-foreground space-y-2">
        <p><strong>Active:</strong> Grants full access to all features.</p>
        <p><strong>Lifetime:</strong> Permanent access that never expires.</p>
        <p><strong>Inactive:</strong> Restricts access to the subscription page only.</p>
      </div>

      <Button 
        onClick={handleUpdate} 
        className="w-full font-bold h-11" 
        disabled={isSubmitting}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Save Subscription Status"}
      </Button>
    </div>
  );
};

export default EditInstructorSubscription;