"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, Loader2, ClipboardCheck } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PLANS = [
  {
    id: "pro_monthly",
    name: "Monthly Pro",
    price: "3.99",
    interval: "month",
    subscriptionUrl: "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-35161195GX886664PNHTGQPY", 
    description: "Full access to all professional instructor features.",
    features: [
      "Unlimited Students",
      "Full Schedule Management",
      "Progress Tracking & Reports",
      "Financial Accounts & Mileage",
      "Student App Access",
      "AI Assistant Included"
    ],
    highlight: true
  }
];

const Subscription: React.FC = () => {
  const { user, subscriptionStatus } = useSession();
  const [isActivating, setIsActivating] = useState(false);
  const [orderId, setOrderId] = useState("");

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  const handleSubscribe = (url: string) => {
    window.open(url, "_blank");
  };

  const handleInstantActivate = async () => {
    if (!user || !orderId.trim()) return;
    setIsActivating(true);
    
    try {
      // 1. Update the user's profile to 'active' immediately
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ subscription_status: 'active' })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // 2. Record the activation for the owner to verify
      const { error: claimError } = await supabase
        .from("subscription_claims")
        .insert({
          user_id: user.id,
          stripe_session_id: orderId.trim(), // Reusing field for PayPal Subscription ID
          status: 'auto_approved'
        });

      if (claimError) throw claimError;

      showSuccess("Account activated! Welcome to the Pro plan.");
      setOrderId("");
      
      // Force a page reload to update the UI/Sidebar
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Activation error:", error);
      showError("Failed to activate: " + error.message);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center max-w-2xl mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-100">
          <ShieldCheck className="h-3 w-3" />
          Secure Monthly Subscription via PayPal
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {isSubscribed ? "Your Subscription" : "Upgrade to Pro"}
        </h1>
        <p className="text-muted-foreground font-medium">
          Unlock the full power of the Driving Instructor App with a recurring monthly plan.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 max-w-4xl w-full">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={cn(
            "relative flex flex-col transition-all duration-300 hover:shadow-xl border-2",
            plan.highlight ? "border-primary shadow-md" : "border-muted",
            isSubscribed && "border-green-500/50 bg-green-50/5"
          )}>
            <CardHeader>
              <div className="flex flex-col items-start">
                {isSubscribed && (
                  <Badge className="bg-green-600 font-bold px-3 py-1 rounded-full mb-4">
                    <Zap className="h-3.5 w-3.5 mr-1.5" /> Active Plan
                  </Badge>
                )}
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black">£{plan.price}</span>
                <span className="text-muted-foreground font-medium">/{plan.interval}</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button 
                className={cn(
                  "w-full font-bold h-12 text-lg",
                  isSubscribed ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                )}
                onClick={() => handleSubscribe(plan.subscriptionUrl)}
                disabled={isSubscribed}
              >
                {isSubscribed ? "Current Plan" : "Subscribe with PayPal"}
              </Button>
            </CardFooter>
          </Card>
        ))}

        {/* Instant Activation Section */}
        {!isSubscribed && (
          <Card className="border-dashed border-2 flex flex-col justify-center p-6 bg-muted/10">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Already Subscribed?
              </CardTitle>
              <CardDescription>
                Enter your **PayPal Subscription ID** (starts with I-...) to activate your account instantly.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderId" className="text-xs font-bold uppercase">Subscription ID</Label>
                <Input 
                  id="orderId"
                  placeholder="e.g. I-12345ABCDE"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                className="w-full font-bold h-12"
                onClick={handleInstantActivate}
                disabled={isActivating || !orderId.trim()}
              >
                {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Activate My Account
              </Button>
              <p className="text-[10px] text-muted-foreground text-center italic">
                Note: Your subscription will be verified by the owner.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Subscription;