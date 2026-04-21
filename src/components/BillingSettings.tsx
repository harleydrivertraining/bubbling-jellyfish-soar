"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck, Mail, HelpCircle } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const BillingSettings: React.FC = () => {
  const { subscriptionStatus } = useSession();

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm bg-card overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Subscription Status
            </CardTitle>
            <Badge variant={isSubscribed ? "default" : "outline"} className="font-bold px-3 py-1 rounded-full">
              {subscriptionStatus?.toUpperCase() || "INACTIVE"}
            </Badge>
          </div>
          <CardDescription>Manage your professional account and billing preferences.</CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-6">
          <div className="p-4 rounded-xl bg-muted/30 border border-muted space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold">Professional Access</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isSubscribed 
                    ? "Your account has full access to all professional features. Thank you for being a Pro member!" 
                    : "Your account is currently on the basic plan. Upgrade to Pro to unlock all features."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Subscription Management
            </h3>
            
            <div className="text-xs text-muted-foreground space-y-3 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <p className="font-bold text-blue-900 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Need to cancel or change your plan?
              </p>
              <p className="text-blue-800/80">
                To manage your subscription, update payment methods, or request a cancellation, please visit the <Link to="/support" className="text-blue-600 font-bold hover:underline">Support Page</Link> and send us a message. Our team will assist you manually.
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 sm:p-6 bg-muted/10 border-t">
          <Button asChild className="w-full font-bold h-12" variant="outline">
            <Link to="/subscription">
              View Subscription Plans
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BillingSettings;