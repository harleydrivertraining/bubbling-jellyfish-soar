"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, ShieldCheck, AlertCircle, XCircle, Mail } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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
        
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-6">
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

          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              How to Cancel
            </h3>
            
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground space-y-2 bg-muted/20 p-4 rounded-lg border">
                <p className="font-bold text-foreground">If you have a PayPal Account:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Click the <strong>Manage PayPal Subscriptions</strong> button below.</li>
                  <li>Find <strong>"Driving Instructor App"</strong> and select <strong>Cancel</strong>.</li>
                </ol>
              </div>

              <div className="text-xs text-muted-foreground space-y-2 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                <p className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  No PayPal Account? (Guest Checkout)
                </p>
                <p>If you paid with a card without signing in:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Check your email for the <strong>PayPal Receipt</strong>. It contains a link to manage your guest subscription.</li>
                  <li>Alternatively, go to the <Link to="/support" className="text-blue-600 font-bold hover:underline">Support Page</Link> and send us a message. We can cancel it for you manually.</li>
                </ul>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground italic px-1">
              Note: Your Pro features will remain active until the end of your current billing cycle.
            </p>
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