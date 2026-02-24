"use client";

import { showError, showSuccess } from "./toast";

// Define the product ID for your subscription
export const PRO_SUBSCRIPTION_ID = "hdt_pro_monthly";

export const initBilling = () => {
  if (typeof window === "undefined" || !window.CdvPurchase) return;

  const { store, ProductType, Platform } = window.CdvPurchase;

  // Register products
  store.register([{
    id: PRO_SUBSCRIPTION_ID,
    type: ProductType.PAID_SUBSCRIPTION,
    platform: Platform.GOOGLE_PLAY,
  }]);

  // Handle purchase updates
  store.when()
    .approved((transaction) => {
      console.log("Purchase approved:", transaction);
      transaction.verify();
    })
    .verified((receipt) => {
      console.log("Purchase verified:", receipt);
      receipt.finish();
      showSuccess("Successfully upgraded to Pro!");
      // Here you would typically update the user's profile in Supabase
    })
    .finished((transaction) => {
      console.log("Transaction finished:", transaction);
    });

  // Initialize the store
  store.initialize([Platform.GOOGLE_PLAY]);
};

export const purchasePro = () => {
  if (typeof window === "undefined" || !window.CdvPurchase) {
    showError("Billing is only available on the Android app.");
    return;
  }

  const { store } = window.CdvPurchase;
  const product = store.get(PRO_SUBSCRIPTION_ID);

  if (product && product.canPurchase) {
    store.order(product);
  } else {
    showError("Subscription is currently unavailable. Please try again later.");
  }
};