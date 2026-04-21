"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

interface PayPalSubscriptionButtonProps {
  planId: string;
  onApprove: (subscriptionId: string) => void;
}

const PayPalSubscriptionButton: React.FC<PayPalSubscriptionButtonProps> = ({ planId, onApprove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = "AWFJSKD2DXqY_dAZjktQspCZsvwM1M6j_qWsUgrlidsU4mwqyr-DvduPs2UXd11HgLFylQqDvnIKDltz";
    const scriptId = "paypal-sdk-script";

    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initializeButton = () => {
      if (window.paypal && containerRef.current) {
        containerRef.current.innerHTML = "";
        
        window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: function(data: any, actions: any) {
            return actions.subscription.create({
              plan_id: planId
            });
          },
          onApprove: function(data: any, actions: any) {
            setIsProcessing(true);
            console.log("PayPal Subscription Approved:", data.subscriptionID);
            onApprove(data.subscriptionID);
          },
          onCancel: function(data: any) {
            console.log("PayPal Subscription Cancelled");
            setIsProcessing(false);
          },
          onError: function(err: any) {
            console.error("PayPal SDK Error:", err);
            setIsProcessing(false);
            showError("PayPal encountered an error. Please try again or use a different browser.");
          }
        }).render(containerRef.current);
        setIsLoaded(true);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
      script.setAttribute("data-sdk-integration-source", "button-factory");
      script.async = true;
      script.onload = initializeButton;
      document.body.appendChild(script);
    } else {
      if (window.paypal) {
        initializeButton();
      } else {
        script.onload = initializeButton;
      }
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [planId, onApprove]);

  return (
    <div className="w-full min-h-[150px] flex flex-col items-center justify-center">
      {(!isLoaded || isProcessing) && !error && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-black uppercase tracking-widest text-primary">
            {isProcessing ? "Processing Payment..." : "Loading PayPal..."}
          </p>
          {isProcessing && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 max-w-xs">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-800 leading-relaxed">
                If you have finished paying but this screen doesn't change, please <strong>manually return to the app</strong> and click "Check for Payment".
              </p>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive font-bold text-center p-4 border border-destructive/20 bg-destructive/5 rounded-xl">
          {error}
        </p>
      )}
      <div ref={containerRef} className={cn("w-full", (!isLoaded || isProcessing) && "hidden")} />
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

declare global {
  interface Window {
    paypal: any;
  }
}

export default PayPalSubscriptionButton;