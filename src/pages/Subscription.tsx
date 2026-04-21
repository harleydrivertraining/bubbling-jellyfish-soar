"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, Loader2, ClipboardCheck, Mail, XCircle, ExternalLink, Info, RefreshCcw } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams, Link } from "react-router-dom";

// --- CONFIGURATION ---
const PAYPAL_PLAN_ID = "P-8BE947115X9658739NHTMIOI"; 
const PLAN_PRICE = "3.99";
// ---------------------

const PLANS = [
  {
    id: "pro_monthly",
    name: "Monthly Pro",
    price: PLAN_PRICE,
    interval: "month",
    subscriptionUrl: `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${PAYPAL_PLAN_ID}&return=${encodeURIComponent(window.location.origin + '/subscription')}`, 
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [isActivating, setIsActivating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderId, setOrderId] = useState("");

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  // Auto-activate if returning from PayPal with a subscription ID in the URL
  useEffect(() => {
    const subId = searchParams.get("subscription_id") || searchParams.get("ba_token");
    if (subId && user && !isSubscribed && !isActivating) {
      handleInstantActivate(subId);
      setSearchParams({});
    }
  }, [searchParams, user, isSubscribed]);

  const handleSubscribe = (url: string) => {
    window.open(url, "_self");
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    // Force a reload of the page to trigger the SessionContextProvider to re-fetch the profile
    window.location.reload();
  };

  const handleInstantActivate = async (idToUse?: string) => {
    const finalId = idToUse || orderId;
    if (!user || !finalId.trim()) return;
    
    setIsActivating(true);
    try {
      // 1. Create the claim record (this allows the owner to verify if auto-update fails)
      const { error: claimError } = await supabase
        .from("subscription_claims")
        .upsert({
          user_id: user.id,
          stripe_session_id: finalId.trim(),
          status: 'auto_approved'
        }, { onConflict: 'stripe_session_id' });

      if (claimError) throw claimError;

      // 2. Attempt to update the profile status directly
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ subscription_status: 'active' })
        .eq("id", user.id);

      if (profileError) {
        console.warn("Direct profile update failed (likely RLS), but claim was saved:", profileError);
        showSuccess("Payment ID received! We are verifying your account now.");
      } else {
        showSuccess("Account activated! Welcome to the Pro plan.");
      }
      
      // Refresh the app state
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
      
      setOrderId("");
    } catch (error: any) {
      console.error("Activation error:", error);
      showError("Failed to process activation: " + error.message);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-6 sm:py-12 px-4 space-y-8 sm:space-y-12 pb-32">
      <div className="text-center max-w-2xl space-y-3 sm:space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-blue-100">
          <ShieldCheck className="h-3 w-3" />
          Secure Monthly Subscription via PayPal
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
          {isSubscribed ? "Your Subscription" : "Upgrade to Pro"}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium px-2">
          Unlock the full power of the Driving Instructor App with a recurring monthly plan.
        </p>
      </div>

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
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs sm:text-sm font-medium">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter className="p-5 sm:p-6">
              <Button 
                className={cn(
                  "w-full font-bold h-11 sm:h-12 text-base sm:text-lg",
                  isSubscribed ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                )}
                onClick={() => handleSubscribe(plan.subscriptionUrl)}
                disabled={isSubscribed || isActivating}
              >
                {isSubscribed ? "Current Plan" : isActivating ? "Activating..." : "Subscribe with PayPal"}
              </Button>
            </CardFooter>
          </Card>
        ))}

        <div className="space-y-4">
          {!isSubscribed && (
            <Card className="border-dashed border-2 flex flex-col justify-center p-5 sm:p-6 bg-muted/10">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Already Subscribed?
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter your PayPal Subscription ID (starts with I-...) from your confirmation email.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orderId" className="text-[10px] font-bold uppercase">Subscription ID</Label>
                  <Input 
                    id="orderId"
                    placeholder="e.g. I-12345ABCDE"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="h-10"
                  />
                </div>
                <Button 
                  variant="outline" 
                  className="w-full font-bold h-11"
                  onClick={() => handleInstantActivate()}
                  disabled={isActivating || !orderId.trim()}
                >
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Activate My Account
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm bg-blue-50/30">
            <CardHeader className="p-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-blue-600" />
                Check Status
              </CardTitle>
              <CardDescription className="text-[10px]">
                If you've already paid but the app is still locked, click below to refresh your account status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full font-bold text-blue-700 hover:bg-blue-100"
                onClick={handleRefreshStatus}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                Refresh My Account Status
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-4xl w-full space-y-6">
        <div className="flex items-center gap-2 px-1">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-bold">Managing Your Subscription</h2>
        </div>
        
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                PayPal Account Holders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 text-[11px] sm:text-xs text-muted-foreground space-y-3">
              <p>If you have a PayPal account, you can manage or cancel your subscription at any time through your PayPal dashboard:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Log in to PayPal.</li>
                <li>Go to <strong>Settings</strong>{" > "}<strong>Payments</strong>{" > "}<strong>Manage Automatic Payments</strong>.</li>
                <li>Select <strong>"Driving Instructor App"</strong> and click <strong>Cancel</strong>.</li>
              </ol>
              <Button 
                variant="link" 
                className="p-0 h-auto text-blue-600 font-bold text-[11px] sm:text-xs"
                onClick={() => window.open("https://www.paypal.com/myaccount/autopay/", "_blank")}
              >
                Go to PayPal Autopay <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-100 shadow-none">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
                <Mail className="h-4 w-4 text-blue-600" />
                Guest Checkout (No Account)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 text-[11px] sm:text-xs text-blue-800/80 space-y-3">
              <p>If you paid with a card without signing in to PayPal:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Check your email for the <strong>PayPal Receipt</strong>. It contains a unique link to manage or cancel your guest subscription.</li>
                <li>If you cannot find the email, please contact us via the <Link to="/support" className="text-blue-700 font-bold underline">Support Page</Link> and we can cancel it for you manually.</li>
              </ul>
              <p className="text-[10px] italic pt-1">Note: Pro features remain active until the end of your current paid month.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Subscription;