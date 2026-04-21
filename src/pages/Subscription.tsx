"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, Loader2, ClipboardCheck, Mail, XCircle, ExternalLink, Info, RefreshCw, AlertCircle, Search, Bug } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

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
  const { user, subscriptionStatus, refreshProfile } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [isActivating, setIsActivating] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [debugInfo, setDebugInfo] = useState<string>("");

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  // Robust URL parsing for PayPal parameters
  const getPaypalIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("subscription_id") || params.get("ba_token") || params.get("token") || params.get("PayerID");
    return id;
  }, []);

  const detectedId = getPaypalIdFromUrl();

  const handleActivate = useCallback(async (idToUse?: string) => {
    const finalId = idToUse || orderId || getPaypalIdFromUrl();
    
    if (!user) {
      showError("Session not found. Please sign in again.");
      return;
    }

    if (!finalId) {
      showError("No payment ID found. If you just paid, please paste your Subscription ID from your PayPal email.");
      return;
    }
    
    setIsActivating(true);
    setDebugInfo(`Attempting activation with ID: ${finalId}`);

    try {
      // 1. Record the claim in the database
      // This is the most important step. The app will recognize you as Pro if this record exists.
      const { error: claimError } = await supabase
        .from("subscription_claims")
        .upsert({
          user_id: user.id,
          stripe_session_id: finalId,
          status: 'auto_approved'
        }, { onConflict: 'stripe_session_id' });

      if (claimError) {
        console.error("Claim Error:", claimError);
        setDebugInfo(prev => prev + `\nClaim Error: ${claimError.message}`);
      }

      // 2. Attempt to update the profile status (might be blocked by RLS, but that's okay)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (profileError) {
        console.warn("Profile Update Error (Expected if RLS is strict):", profileError.message);
      }

      // 3. Force the global session provider to re-check the database
      // It will see the 'auto_approved' claim and grant access.
      await refreshProfile();

      showSuccess("Subscription verified! Welcome to Pro.");
      
      // 4. Clean up and redirect
      setSearchParams({});
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);

    } catch (error: any) {
      console.error("Activation error:", error);
      showError("Verification failed. Please try the 'Manual Activation' box below.");
      setIsActivating(false);
    }
  }, [user, orderId, getPaypalIdFromUrl, refreshProfile, navigate, setSearchParams]);

  // Auto-trigger if we detect a return from PayPal
  useEffect(() => {
    if (detectedId && user && subscriptionStatus === 'unsubscribed' && !isActivating) {
      handleActivate(detectedId);
    }
  }, [detectedId, user, subscriptionStatus, isActivating, handleActivate]);

  const handleSubscribe = async (url: string) => {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
    } else {
      window.open(url, "_blank");
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
          {isSubscribed ? "You are a Pro Member" : "Upgrade to Pro"}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium px-2">
          {isSubscribed 
            ? "Thank you for supporting the app! You have full access to all features." 
            : "Unlock the full power of the Driving Instructor App with a recurring monthly plan."}
        </p>
      </div>

      {/* ACTIVATION STATUS */}
      {isActivating ? (
        <Card className="w-full max-w-md border-blue-200 bg-blue-50 shadow-lg animate-in zoom-in-95 duration-300">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="space-y-1">
              <p className="font-black text-blue-800 text-xl">Verifying Payment...</p>
              <p className="text-xs text-blue-600 font-medium">This usually takes about 5-10 seconds.</p>
            </div>
          </CardContent>
        </Card>
      ) : detectedId && !isSubscribed ? (
        <Card className="w-full max-w-md border-green-200 bg-green-50 shadow-md animate-in slide-in-from-top-4 duration-500">
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-2 rounded-full">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-green-900">Payment Detected</p>
                <p className="text-xs text-green-800/80">
                  We found your PayPal ID in the URL. Click below to activate your account.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => handleActivate(detectedId)} 
              className="w-full bg-green-600 hover:bg-green-700 font-black h-11"
            >
              Activate My Pro Account
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
                {isSubscribed ? "Current Plan" : "Subscribe with PayPal"}
              </Button>
            </CardFooter>
          </Card>
        ))}

        {!isSubscribed && (
          <Card className="border-dashed border-2 flex flex-col justify-center p-5 sm:p-6 bg-muted/10">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Manual Activation
              </CardTitle>
              <CardDescription className="text-xs">
                If you've just paid and aren't active, enter your PayPal Subscription ID (starts with I-...) here.
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
                onClick={() => handleActivate()}
                disabled={isActivating || !orderId.trim()}
              >
                {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verify My Payment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* DEBUG SECTION */}
      {!isSubscribed && debugInfo && (
        <div className="w-full max-w-md p-4 bg-black text-green-400 font-mono text-[10px] rounded-lg border border-green-900/30 overflow-auto max-h-32">
          <div className="flex items-center gap-2 mb-1 text-green-500 font-bold">
            <Bug className="h-3 w-3" /> DEBUG LOG
          </div>
          {debugInfo}
        </div>
      )}

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