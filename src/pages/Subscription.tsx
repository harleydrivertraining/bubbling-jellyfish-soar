"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, ArrowRight, Loader2, ClipboardCheck } from "lucide-react";
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
    checkoutUrl: "https://yourstore.lemonsqueezy.com/checkout/buy/your_variant_id?embed=1", 
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
  const [isClaiming, setIsClaiming] = useState(false);
  const [orderId, setOrderId] = useState("");

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  const handleSubscribe = (plan: typeof PLANS[0]) => {
    setIsLoading(plan.id);
    const checkoutUrl = new URL(plan.checkoutUrl);
    if (user?.email) checkoutUrl.searchParams.set('checkout[email]', user.email);
    checkoutUrl.searchParams.set('checkout[custom][user_id]', user?.id || '');
    window.location.href = checkoutUrl.toString();
  };

  const handleClaim = async () => {
    if (!user || !orderId.trim()) return;
    setIsClaiming(true);
    
    const { error } = await supabase
      .from("subscription_claims")
      .insert({
        user_id: user.id,
        stripe_session_id: orderId.trim(), // We reuse this field for the Lemon Squeezy Order ID
        status: 'pending'
      });

    if (error) {
      showError("Failed to submit claim: " + error.message);
    } else {
      showSuccess("Payment notification sent to the app owner! They will activate your account shortly.");
      setOrderId("");
    }
    setIsClaiming(false);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center max-w-2xl mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="h-3 w-3" />
          Secure Checkout via Lemon Squeezy
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {isSubscribed ? "Your Subscription" : "Choose Your Plan"}
        </h1>
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
                    <Zap className="h-3.5 w-3.5 mr-1.5" />think
The user wants me to continue the previous response exactly where it left off.
The previous response was a `<dyad-write>` block for `src/pages/Subscription.tsx`.
It cut off at:
```tsx
                {isSubscribed && (
                  <Badge className="bg-green-600 font-bold px-3 py-1 rounded-full mb-4">
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
```

I need to complete the `Subscription.tsx` file and then provide the rest of the response (OwnerDashboard update and summary).

Plan:
1. Complete `src/pages/Subscription.tsx`.
2. Update `src/pages/OwnerDashboard.tsx` to handle the claims.
3. Provide the summary.

Wait, the user said "Continue exactly where you left off without any preamble".
This usually means I should just output the rest of the code block or the rest of the message.

Let's look at the `Subscription.tsx` content I was writing.

```tsx
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
                onClick={() => handleSubscribe(plan)}
                disabled={!!isLoading || isSubscribed}
              >
                {isLoading === plan.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting...</>
                ) : isSubscribed ? (
                  "Current Plan"
                ) : (
                  <>Get Started <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}

        {/* Claim Section */}
        {!isSubscribed && (
          <Card className="border-dashed border-2 flex flex-col justify-center p-6 bg-muted/10">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Already Paid?
              </CardTitle>
              <CardDescription>
                If you've completed your payment on Lemon Squeezy, enter your Order ID below to notify the owner.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderId" className="text-xs font-bold uppercase">Order ID / Reference</Label>
                <Input 
                  id="orderId"
                  placeholder="e.g. 123456"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                className="w-full font-bold"
                onClick={handleClaim}
                disabled={isClaiming || !orderId.trim()}
              >
                {isClaiming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Notify Owner to Activate
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Subscription;
```

Wait, I should probably rewrite the whole file to be safe, but the user said "Continue exactly where you left off".
However, the system instructions say "Only use ONE <dyad-write> block per file that you write!" and "ALWAYS write the entire file".

So I will rewrite the entire `Subscription.tsx` file and then the `OwnerDashboard.tsx` file.

Wait, if I just output the rest of the text, it won't be valid XML. I must use the tags.

I'll start with the full `Subscription.tsx` file.

Wait, the user said "without any preamble".

Let's do it.Active Plan
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
                onClick={() => handleSubscribe(plan)}
                disabled={!!isLoading || isSubscribed}
              >
                {isLoading === plan.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting...</>
                ) : isSubscribed ? (
                  "Current Plan"
                ) : (
                  <>Get Started <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}

        {/* Claim Section */}
        {!isSubscribed && (
          <Card className="border-dashed border-2 flex flex-col justify-center p-6 bg-muted/10">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Already Paid?
              </CardTitle>
              <CardDescription>
                If you've completed your payment on Lemon Squeezy, enter your Order ID below to notify the owner.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderId" className="text-xs font-bold uppercase">Order ID / Reference</Label>
                <Input 
                  id="orderId"
                  placeholder="e.g. 123456"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                className="w-full font-bold"
                onClick={handleClaim}
                disabled={isClaiming || !orderId.trim()}
              >
                {isClaiming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Notify Owner to Activate
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Subscription;