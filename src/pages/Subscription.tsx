"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, Zap, Loader2, ClipboardCheck, Info, RefreshCw, Sparkles, Search, CreditCard } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import PayPalSubscriptionButton from "@/components/PayPalSubscriptionButton";

const PLANS = [
  {
    id: "pro_monthly",
    name: "Monthly Pro",
    price: "3.99",
    interval: "month",
    // Replace this with your actual PayPal Plan ID created in your PayPal Dashboard
    paypalPlanId: "P-placeholder_plan_id_replace_me",
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
  const { user, subscriptionStatus, refreshProfile } = useSession();
  const navigate = useNavigate();
  
  const [isActivating, setIsActivating] = useState(false);
  const [activationCode, setActivationCode] = useState("");

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  const handleSubscriptionSuccess = async (subscriptionId: string) => {
    if (!user?.id) return;
    
    setIsActivating(true);
    try {
      // 1. Record the activation claim for owner verification
      await supabase
        .from("subscription_claims")
        .upsert({
          user_id: user.id,
          stripe_session_id: subscriptionId, // We store the PayPal ID here
          status: 'auto_approved' // Mark as auto-approved for PayPal
        }, { onConflict: 'stripe_session_id' });

      // 2. Update Profile to active immediately
      await supabase
        .from("profiles")
        .update({ 
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      showSuccess("Subscription activated! Welcome to Pro.");
      await refreshProfile();
      
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);

    } catch (error: any) {
      console.error("Activation error:", error);
      showError("There was an issue linking your subscription. Please contact support with your ID: " + subscriptionId);
      setIsActivating(false);
    }
  };

  const handleManualActivate = async (code: string) => {
    if (!user?.id || !code.trim()) return;
    
    setIsActivating(true);
    try {
      await supabase
        .from("subscription_claims")
        .upsert({
          user_id: user.id,
          stripe_session_id: code.trim(),
          status: 'pending'
        }, { onConflict: 'stripe_session_id' });

      await supabase
        .from("profiles")
        .update({ 
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      showSuccess("Pro features activated!");
      await refreshProfile();
      navigate("/", { replace: true });
    } catch (error: any) {
      showError("Activation failed. Please check your code.");
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-6 sm:py-12 px-4 space-y-8 sm:space-y-12 pb-32">
      <div className="text-center max-w-2xl space-y-3 sm:space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 text-primary text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-primary/10">
          <ShieldCheck className="h-3 w-3" />
          Professional Instructor Platform
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
          {isSubscribed ? "You are a Pro Member" : "Upgrade to Pro"}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium px-2">
          Unlock the full power of the Driving Instructor App and manage your business like a pro.
        </p>
      </div>

      {isActivating && (
        <Card className="w-full max-w-md border-primary bg-primary/5 animate-pulse">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-bold">Activating your Pro account...</p>
            <p className="text-xs text-muted-foreground">Please don't close this page.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 sm:gap-8 md:grid-cols-2 max-w-4xl w-full">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={cn(
            "relative flex flex-col transition-all duration-300 hover:shadow-xl border-2",
            plan.highlight ? "border-primary shadow-md" : "border-muted",
            isSubscribed && "border-green-500/50 bg-green-50/5"
          )}>
            <CardHeader className="p-5 sm:p-6">
              <div className="flex flex-col items-start">
                {isSubscribed && (
                  <Badge className="bg-green-600 font-bold px-3 py-1 rounded-full mb-4">
                    <Zap className="h-3.5 w-3.5 mr-1.5" /> Active Plan
                  </Badge>
                )}
                <CardTitle className="text-xl sm:text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{plan.description}</CardDescription>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black">£{plan.price}</span>
                <span className="text-muted-foreground font-medium text-sm">/{plan.interval}</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-5 sm:p-6 pt-0 sm:pt-0">
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs sm:text-sm font-medium">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>

              {!isSubscribed && (
                <div className="space-y-4">
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-bold">Subscribe with PayPal</span></div>
                  </div>
                  <PayPalSubscriptionButton 
                    planId={plan.paypalPlanId} 
                    onApprove={handleSubscriptionSuccess}
                    onError={() => showError("PayPal checkout failed. Please try again.")}
                  />
                </div>
              )}
            </CardContent>

            {isSubscribed && (
              <CardFooter className="p-5 sm:p-6">
                <Button 
                  className="w-full font-bold h-12 text-lg bg-green-600 hover:bg-green-700"
                  disabled
                >
                  Current Plan
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}

        {!isSubscribed && (
          <div className="space-y-4">
            <Card className="border-dashed border-2 flex flex-col justify-center p-5 sm:p-6 bg-muted/10">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Manual Activation
                </CardTitle>
                <CardDescription className="text-xs">
                  If you have an activation code or reference, enter it below to unlock your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-[10px] font-bold uppercase">Reference / Code</Label>
                  <Input 
                    id="code"
                    placeholder="Enter code..."
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value)}
                    className="h-10"
                  />
                </div>
                <Button 
                  variant="outline" 
                  className="w-full font-bold h-11"
                  onClick={() => handleManualActivate(activationCode)}
                  disabled={isActivating || !activationCode.trim()}
                >
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Activate Pro
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed border-2 flex flex-col justify-center p-5 sm:p-6 bg-muted/10">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Refresh Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Already upgraded? Click below to sync your account status.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Button 
                  variant="ghost" 
                  className="w-full font-bold h-11 border"
                  onClick={async () => {
                    setIsActivating(true);
                    await refreshProfile();
                    setIsActivating(false);
                  }}
                  disabled={isActivating}
                >
                  Check Status
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="max-w-4xl w-full p-6 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-start gap-4">
        <Info className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
        <div className="space-y-1">
          <h3 className="font-bold text-blue-900">Automatic Monthly Billing</h3>
          <p className="text-sm text-blue-800/80 leading-relaxed">
            Subscriptions are handled securely via PayPal. You can cancel at any time through your PayPal account settings. Pro features will remain active until the end of your current billing period.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Subscription;