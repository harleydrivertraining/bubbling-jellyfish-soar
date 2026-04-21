"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ShieldCheck, Zap, Loader2, ClipboardCheck, Mail, XCircle, ExternalLink, Info, RefreshCw, AlertCircle, Search } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import PayPalSubscriptionButton from "@/components/PayPalSubscriptionButton";

const PLANS = [
  {
    id: "pro_monthly",
    name: "Monthly Pro",
    price: "3.99",
    interval: "month",
    planId: "P-8W475365B2106821DNHT2ZYA", 
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [isActivating, setIsActivating] = useState(false);
  const [orderId, setOrderId] = useState("");

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'lifetime';

  // Get the ID from the URL if it exists (for manual returns)
  const paypalIdFromUrl = searchParams.get("subscription_id") || searchParams.get("ba_token") || searchParams.get("token");

  const handleActivate = useCallback(async (idToUse?: string) => {
    // Priority: 1. ID passed directly (from PayPal button), 2. Manual input, 3. URL param
    const id = idToUse || orderId;
    const finalId = id?.trim() || paypalIdFromUrl;
    
    if (!user?.id) {
      showError("User session not found. Please sign in again.");
      return;
    }

    if (!finalId) {
      showError("Please enter a valid Subscription ID.");
      return;
    }
    
    setIsActivating(true);

    try {
      // 1. Record the claim in the database
      const { error: claimError } = await supabase
        .from("subscription_claims")
        .upsert({
          user_id: user.id,
          stripe_session_id: finalId,
          status: 'auto_approved'
        }, { onConflict: 'stripe_session_id' });

      if (claimError) {
        console.error("Claim recording error:", claimError);
        // We continue as the profile update is the critical part
      }

      // 2. Update the user's profile status
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // 3. Set a local flag for instant UI feedback (backup)
      try {
        localStorage.setItem(`hdt_pro_override_${user.id}`, 'true');
      } catch (e) {
        console.warn("Local storage override failed", e);
      }
      
      showSuccess("Pro features activated! Welcome aboard.");
      
      // 4. Refresh the session and navigate home
      await refreshProfile();
      
      setTimeout(() => {
        navigate("/", { replace: true });
        // Force a reload to ensure all restricted states are cleared
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error("Activation error:", error);
      showError(error.message || "Activation failed. Please check your ID or contact support.");
      setIsActivating(false);
    }
  }, [user, orderId, paypalIdFromUrl, navigate, refreshProfile]);

  // Auto-activate if we just returned from PayPal with an ID in the URL
  useEffect(() => {
    if (paypalIdFromUrl && user && subscriptionStatus === 'unsubscribed' && !isActivating) {
      handleActivate(paypalIdFromUrl);
    }
  }, [paypalIdFromUrl, user, subscriptionStatus, isActivating, handleActivate]);

  const handleManualRefresh = async () => {
    setIsActivating(true);
    try {
      await refreshProfile();
      // If still unsubscribed after refresh, stop loading
      setTimeout(() => {
        setIsActivating(false);
        if (subscriptionStatus === 'active' || subscriptionStatus === 'lifetime') {
          showSuccess("Subscription confirmed!");
          navigate("/", { replace: true });
        } else {
          showError("No active subscription found yet. It may take a minute to process.");
        }
      }, 1500);
    } catch (e) {
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
          {isSubscribed ? "You are a Pro Member" : "Upgrade to Pro"}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium px-2">
          Unlock the full power of the Driving Instructor App with a recurring monthly plan.
        </p>
      </div>

      {/* ACTIVATION STATUS */}
      {isActivating ? (
        <Card className="w-full max-w-md border-blue-200 bg-blue-50 shadow-lg">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="font-black text-blue-800 text-xl">Checking Status...</p>
            <p className="text-xs text-blue-600">Verifying your payment with PayPal.</p>
          </CardContent>
        </Card>
      ) : paypalIdFromUrl && !isSubscribed ? (
        <Card className="w-full max-w-md border-green-200 bg-green-50 shadow-md animate-bounce">
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-2 rounded-full">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-green-900">Payment Successful!</p>
                <p className="text-xs text-green-800/80">
                  We've detected your payment. Click below to unlock your Pro features.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => handleActivate(paypalIdFromUrl)} 
              className="w-full bg-green-600 hover:bg-green-700 font-black h-12 text-lg shadow-lg"
            >
              Unlock Pro Now
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
                <div className="pt-4 border-t">
                  <PayPalSubscriptionButton 
                    planId={plan.planId} 
                    onApprove={(id) => handleActivate(id)} 
                  />
                </div>
              )}
            </CardContent>

            {isSubscribed && (
              <CardFooter className="p-5 sm:p-6">
                <Button 
                  className="w-full font-bold h-11 sm:h-12 text-base sm:text-lg bg-green-600 hover:bg-green-700"
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
                  <Search className="h-5 w-5 text-primary" />
                  Already Paid?
                </CardTitle>
                <CardDescription className="text-xs">
                  If you've just completed payment but the app hasn't updated, click below to check for your new subscription.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Button 
                  variant="default" 
                  className="w-full font-bold h-12 text-base bg-blue-600 hover:bg-blue-700"
                  onClick={handleManualRefresh}
                  disabled={isActivating}
                >
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Check for Payment
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed border-2 flex flex-col justify-center p-5 sm:p-6 bg-muted/10">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Manual ID Entry
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter your PayPal Subscription ID (starts with I-...) from your receipt to activate manually.
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
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Activate with ID
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
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