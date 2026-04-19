"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Zap, Infinity, Clock, ShieldCheck, Loader2 } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

const BillingSettings: React.FC = () => {
  const { subscriptionStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-management', {
        body: { 
          action: 'portal', 
          returnUrl: window.location.origin + "/settings"
        }
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      console.error("Portal error:", err);
      showError("Could not open billing portal. Ensure your Edge Function is deployed.");
    } finally {
      setIsLoading(false);
    }
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
        
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="p-4 rounded-xl bg-muted/30 border border-muted space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Secure Billing via Stripe</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We use Stripe to process all payments securely. We never store your card details on our servers.
                </p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 sm:p-6 bg-muted/10 border-t">
          <Button 
            onClick={handleManageBilling} 
            className="w-full font-bold h-12" 
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Manage Payment Methods & Invoices
          </Button>
        </CardFooter>
      </Card>

      <div className="px-2">
        <p className="text-[10px] text-muted-foreground text-center">
          Need help with your billing? Contact our support team via the Support tab.
        </p>
      </div>
    </div>
  );
};

export default BillingSettings;