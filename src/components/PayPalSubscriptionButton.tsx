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
  // Live PayPal Client ID
  const PAYPAL_CLIENT_ID = "AcOO9id17TgIkgRPk9-JUBmSQB2TTaoM1Nv9ZOZ3ALA_DtEltr87zyGp2wHcAsnX3WF7PHaEBEmh_8Sd";

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