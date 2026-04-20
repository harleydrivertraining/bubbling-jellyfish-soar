"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const BillingSettings: React.FC = () => {
  const { subscriptionStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManageBilling = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('autumn-management', {
        body: { 
          action: 'portal',
          returnUrl: window.location.href 
        },
      });

      if (invokeError) throw invokeError;
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Could not generate portal link.");
      }
    } catch (err: any) {
      console.error("Autumn portal error:", err);
      setError("We couldn't open the Autumn billing portal. Please ensure your account is fully set up.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm bg-card overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Billing & Subscription
            </CardTitle>
            <Badge variant="outline" className="font-bold px-3 py-1 rounded-full">
              {subscriptionStatus?.toUpperCase() || "INACTIVE"}
            </Badge>
          </div>
          <CardDescription>Manage your professional subscription and payment history.</CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-muted space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Managed by Autumn</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your subscription is securely managed. You can update your plan or cancel at any time through the portal.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex items-start gap-3 text-destructive animate-in fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 sm:p-6 bg-muted/10 border-t">
          <Button 
            onClick={handleManageBilling} 
            className="w-full font-bold h-12" 
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening Portal...</>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Subscription & Invoices
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BillingSettings;