"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Zap, Infinity, Clock, ShieldCheck, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const BillingSettings: React.FC = () => {
  const { subscriptionStatus } = useSession();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManageBilling = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('stripe-management', {
        body: { 
          action: 'portal',
          returnUrl: window.location.href 
        },
      });

      if (invokeError) throw invokeError;
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("The billing service returned an empty link.");
      }
    } catch (err: any) {
      console.error("Portal error:", err);
      setError("We couldn't open the billing portal automatically. This usually means the backend service is still being configured.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRequest = () => {
    navigate("/support");
  };

  const getStatusInfo = () => {
    if (subscriptionStatus === 'lifetime') {
      return {
        label: "Lifetime Access",
        icon: Infinity,
        color: "bg-blue-600",
        description: "You have permanent professional access. No further payments are required."
      };
    }
    if (subscriptionStatus === 'active') {
      return {
        label: "Pro Subscription",
        icon: Zap,
        color: "bg-green-600",
        description: "Your monthly subscription is active. You have full access to all features."
      };
    }
    return {
      label: "Inactive",
      icon: Clock,
      color: "bg-muted text-muted-foreground",
      description: "You do not have an active subscription. Please subscribe to unlock all features."
    };
  };

  const status = getStatusInfo();

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm bg-card overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Subscription Status
            </CardTitle>
            <Badge className={cn("font-bold px-3 py-1 rounded-full", status.color)}>
              <status.icon className="h-3.5 w-3.5 mr-1.5" />
              {status.label}
            </Badge>
          </div>
          <CardDescription>{status.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-muted space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Secure Billing via Stripe</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage your payment methods, view invoices, and update or cancel your plan securely via Stripe.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold">Manual Management Required</p>
                  <p className="text-xs leading-relaxed">
                    {error}
                  </p>
                </div>
              </div>
              
              <div className="pl-8 space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground">
                  To cancel or update your plan manually:
                </p>
                <ul className="text-[11px] list-disc list-inside text-muted-foreground space-y-1">
                  <li>Check your email for your original <strong>Stripe Receipt</strong>.</li>
                  <li>Click the <strong>"Manage Subscription"</strong> link inside that email.</li>
                </ul>
                
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full font-bold text-xs h-9"
                    onClick={handleManualRequest}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-2" />
                    Contact Support to Cancel
                  </Button>
                </div>
              </div>
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