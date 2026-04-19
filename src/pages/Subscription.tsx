"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, CreditCard, ArrowRight, Infinity, Clock, AlertCircle } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly Pro",
    price: "3.99",
    // REPLACE THIS with your actual Stripe Payment Link URL
    paymentLink: "https://buy.stripe.com/test_your_actual_link", 
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
  const { subscriptionStatus, userRole } = useSession();

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';
  const isInstructor = userRole === 'instructor';
  const isRestricted = isInstructor && !isSubscribed;

  const handleSubscribe = (link: string) => {
    window.open(link, "_blank");
  };

  const getStatusBadge = () => {
    if (subscriptionStatus === 'lifetime') {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 font-bold px-3 py-1 rounded-full mb-4">
          <Infinity className="h-3.5 w-3.5 mr-1.5" /> Lifetime Access Active
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
      {isRestricted && (
        <div className="w-full max-w-md mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <Alert variant="destructive" className="border-2 shadow-lg bg-destructive/5">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-black text-lg">Please Subscribe to use the app</AlertTitle>
            <AlertDescription className="font-medium">
              Your account is currently inactive. Choose a plan below to unlock all professional features. 
              <br /><br />
              <span className="text-xs opacity-80">Note: After paying, your account will be activated by our team within 24 hours.</span>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="text-center max-w-2xl mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="h-3 w-3" />
          Secure Professional Access
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
                onClick={() => handleSubscribe(plan.paymentLink)}
              >
                {isSubscribed ? "Manage Subscription" : `Get Started with ${plan.name}`}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Subscription;