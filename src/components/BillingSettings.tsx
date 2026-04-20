"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BillingSettings: React.FC = () => {
  const { subscriptionStatus } = useSession();

  const handleManageBilling = () => {
    window.open("https://www.paypal.com/myaccount/autopay/", "_blank");
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
                <p className="text-sm font-bold">Managed via PayPal</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your subscription is handled securely through PayPal. You can manage your recurring payments or update your payment method directly in your PayPal account.
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
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage PayPal Subscriptions
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BillingSettings;