"use client";

import React from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Loader2 } from "lucide-react";

interface PayPalSubscriptionButtonProps {
  planId: string;
  onApprove: (subscriptionId: string) => void;
  onError?: (error: any) => void;
}

const PayPalSubscriptionButton: React.FC<PayPalSubscriptionButtonProps> = ({ 
  planId, 
  onApprove, 
  onError 
}) => {
  // Replace with your actual PayPal Client ID from the PayPal Developer Dashboard
  const PAYPAL_CLIENT_ID = "AWY_placeholder_client_id_replace_me";

  return (
    <div className="w-full min-h-[150px] flex flex-col justify-center">
      <PayPalScriptProvider
        options={{
          clientId: PAYPAL_CLIENT_ID,
          vault: true,
          intent: "subscription",
          currency: "GBP",
        }}
      >
        <PayPalButtons
          style={{
            shape: "rect",
            color: "gold",
            layout: "vertical",
            label: "subscribe",
          }}
          createSubscription={(data, actions) => {
            return actions.subscription.create({
              plan_id: planId,
            });
          }}
          onApprove={async (data, actions) => {
            if (data.subscriptionID) {
              onApprove(data.subscriptionID);
            }
          }}
          onError={(err) => {
            console.error("PayPal Error:", err);
            if (onError) onError(err);
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
};

export default PayPalSubscriptionButton;