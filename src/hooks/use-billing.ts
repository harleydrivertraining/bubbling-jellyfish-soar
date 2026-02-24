"use client";

import { useState, useEffect } from "react";
import { PRO_SUBSCRIPTION_ID } from "@/utils/billing";

export const useBilling = () => {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.CdvPurchase) {
      setIsLoading(false);
      return;
    }

    const { store } = window.CdvPurchase;

    const updateStatus = () => {
      const p = store.get(PRO_SUBSCRIPTION_ID);
      setProduct(p);
      setIsPro(store.owned(PRO_SUBSCRIPTION_ID));
      setIsLoading(false);
    };

    store.ready(updateStatus);
    store.when().updated(updateStatus);

    return () => {
      // Cleanup listeners if necessary
    };
  }, []);

  return { isPro, isLoading, product };
};