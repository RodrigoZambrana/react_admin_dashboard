"use client";

import { useEffect, useRef } from "react";

import { trackBeginCheckout } from "@/lib/analytics";
import { useStorefrontCart } from "@/state/cart-context";

export default function CheckoutAnalytics() {
  const { state, isHydrated } = useStorefrontCart();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || trackedRef.current || state.items.length === 0) {
      return;
    }

    trackedRef.current = true;
    trackBeginCheckout(
      state.items.map(({ product, quantity }) => ({
        ...product,
        quantity,
      }))
    );
  }, [isHydrated, state.items]);

  return null;
}
