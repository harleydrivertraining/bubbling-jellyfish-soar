"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, CreditCard, ArrowRight } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly Pro",
    price: "3.99",
    interval: "month",
    description: "Perfect for individual instructors.",
    features: [
      "Unlimited Students",
      "Full Schedule Management",
      "Progress Tracking & Reports",
      "Financial Accounts & Mileage",
      "Student App Access",
      "AI Assistant Included"
    ],
    highlight: false
  },
  {
    id: "yearly",
    name: "Annual Saver",
    price: "149.99",
    interval: "year",
    description: "Best value for long-term growth.",
    features: [
      "Everything in Monthly",
      "2 Months Free",
      "Priority Support",
      "Early Access to Features"
    ],
    highlight: true,
    badge: "Best Value"
  }
];

const Subscription: React.FC = () => {
  const { user } = useSession();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = (planId: string) => {
    setLoadingPlan(planId);
    // In a real implementation, this would call a Supabase Edge Function 
    // to create a Stripe Checkout session and redirect the user.
    console.log(`Redirecting to Stripe for plan: ${planId}`);
    
    // For now, we'll show a message
    setTimeout(() => {
      alert("Stripe Integration Required: To complete this, you'll need to connect your Stripe account in the Supabase dashboard.");
      setLoadingPlan(null);
    }, 1000);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center max-w-2xl mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="h-3 w-3" />
          Secure Professional Access
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Choose Your Plan
        </h1>
        <p className="text-lg text-muted-foreground font-medium">
          Unlock the full power of the Driving Instructor App and streamline your business today.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 w-full max-w-4xl">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={cn(
            "relative flex flex-col transition-all duration-300 hover:shadow-xl border-2",
            plan.highlight ? "border-primary shadow-md scale-105" : "border-muted"
          )}>
            {plan.badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                {plan.badge}
              </div>
            )}
            
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
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
                className="w-full font-bold h-12 text-lg" 
                variant={plan.highlight ? "default" : "outline"}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === plan.id ? "Connecting..." : `Get Started with ${plan.name}`}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-6 text-muted-foreground opacity-60">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs font-bold uppercase">Secure Payment</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-bold uppercase">Instant Activation</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground max-w-md">
          Subscriptions are managed via Stripe. You can cancel or change your plan at any time from your account settings.
        </p>
      </div>
    </div>
  );
};

export default Subscription;