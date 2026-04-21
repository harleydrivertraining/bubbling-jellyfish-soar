"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface PayPalSubscriptionButtonProps {
  planId: string;
  onApprove: (subscriptionId: string) => void;
}

const PayPalSubscriptionButton: React.FC<PayPalSubscriptionButtonProps> = ({ planId, onApprove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = "AWFJSKD2DXqY_dAZjktQspCZsvwM1M6j_qWsUgrlidsU4mwqyr-DvduPs2UXd11HgLFylQqDvnIKDltz";
    const scriptId = "paypal-sdk-script";

    // Check if script already exists
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initializeButton = () => {
      if (window.paypal && containerRef.current) {
        // Clear container before rendering to prevent duplicates
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
            onApprove(data.subscriptionID);
          },
          onError: function(err: any) {
            console.error("PayPal Error:", err);
            setError("The PayPal button failed to load. Please refresh the page.");
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
      // Script exists, just initialize if paypal is ready
      if (window.paypal) {
        initializeButton();
      } else {
        script.onload = initializeButton;
      }
    }

    return () => {
      // We don't remove the script to avoid reloading it if the user navigates back
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [planId, onApprove]);

  return (
    <div className="w-full min-h-[150px] flex flex-col items-center justify-center">
      {!isLoaded && !error && (
        <div className="flex flex-col items-center gap-2 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Loading PayPal...</p>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive font-medium text-center p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
          {error}
        </p>
      )}
      <div ref={containerRef} className={cn("w-full", !isLoaded && "hidden")} />
    </div>
  );
};

// Helper for tailwind classes inside the component
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

declare global {
  interface Window {
    paypal: any;
  }
}

export default PayPalSubscriptionButton;