"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, CreditCard, ArrowRight, Infinity, Clock } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
    highlight: true
  }
];

const Subscription: React.FC = () => {
  const { user, subscriptionStatus } = useSession();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'lifetime';

  const handleSubscribe = (planId: string) => {
    if (isSubscribed) {
      // In a real app, this would redirect to the Stripe Customer Portal
      window.open("https://billing.stripe.com/p/login/test_your_portal_link", "_blank");
      return;
    }

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

  const getStatusBadge = () => {
    if (subscriptionStatus === 'lifetime') {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 font-bold px-3 py-1 rounded-full mb-4">
          <Infinity className="h-3.5 w-3.5 mr-1.5" /> Lifetime Access Active
        </Badge>
      );
    }
    if (subscriptionStatus === 'trialing') {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 font-bold px-3 py-1 rounded-full mb-4">
          <Clock className="h-3.5 w-3.5 mr-1.5" /> Trial Period Active
        </Badge>
      );
    }
    if (subscriptionStatus === 'active') {
      return (
        <Badge className="bg-green-600 hover:bg-green-700 font-bold px-3 py-1 rounded-full mb-4">
          <Zap className="h-3.5 w-3.5 mr-1.5" /> Pro Subscription Active
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center max-w-2xl mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="h-3 w-3" />
          Secure Professional Access
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {isSubscribed ? "Your Subscription" : "Choose Your Plan"}
        </h1>
        <p className="text-lg text-muted-foreground font-medium">
          {isSubscribed 
            ? "You have full access to all professional features. Manage your billing below."
            : "Unlock the full power of the Driving Instructor App and streamline your business today."}
        </p>
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
                {getStatusBadge()}
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
                variant={plan.highlight ? "default" : "outline"}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === plan.id ? "Connecting..." : 
                 isSubscribed ? "Manage Subscription" : `Get Started with ${plan.name}`}
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