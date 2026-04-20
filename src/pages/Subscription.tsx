"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

const PLANS = [
  {
    id: "pro_monthly", // This should match your Autumn Plan ID
    name: "Monthly Pro",
    price: "3.99",
    interval: "month",
    description: "Full access for individual instructors.",
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
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  const handleSubscribe = async (planId: string) => {
    setIsLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke('autumn-management', {
        body: { 
          action: 'checkout',
          planId: planId,
          successUrl: window.location.origin + "/?subscribed=true",
          cancelUrl: window.location.href
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Could not generate checkout link.");
      }
    } catch (err: any) {
      console.error("Autumn checkout error:", err);
      showError("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center max-w-2xl mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="h-3 w-3" />
          Powered by Autumn
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {isSubscribed ? "Your Subscription" : "Choose Your Plan"}
        </h1>
      </div>

      <div className="flex justify-center w-full max-w-md">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={cn(
            "relative flex flex-col transition-all duration-300 hover:shadow-xl border-2 w-full",
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
                  isSubscribed ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90"
                )}
                onClick={() => handleSubscribe(plan.id)}
                disabled={!!isLoading || isSubscribed}
              >
                {isLoading === plan.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</>
                ) : isSubscribed ? (
                  "Current Plan"
                ) : (
                  <>Get Started <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Subscription;