"use client";

import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useStorefrontCart } from "@/state/cart-context";
import { getAnalyticsContext } from "@/lib/analytics/session";
import { buildCanonicalAnalyticsContext } from "@/lib/analytics/product-context";

export default function CheckoutAnalytics() {
  const { state, isHydrated } = useStorefrontCart();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || trackedRef.current || state.items.length === 0) {
      return;
    }

    trackedRef.current = true;
    const context = getAnalyticsContext();
    const items = state.items.map(({ product, quantity }) => ({
      ...product,
      quantity,
      ...buildCanonicalAnalyticsContext({
        canonicalConfiguration: product.canonicalConfiguration ?? null,
        configuration: product.configuration ?? null
      })
    }));
    const cartValue = state.items.reduce((sum, item) => sum + item.product.price.amount * item.quantity, 0);
    void trackEvent({
      event_name: "begin_checkout",
      event_category: "conversion",
      tenant_id: env.clientSlug,
      page_type: resolvePageType(context.path),
      component_type: "checkout",
      component_id: "checkout_begin",
      cta_id: "checkout.continue_to_payment",
      cta_name: "begin_checkout",
      cta_type: "primary",
      cta_context: "checkout",
      cta_location: "checkout_summary",
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        items_count: state.items.length,
        cart_value: cartValue,
        items,
      },
      data: {
        items_count: state.items.length,
        cart_value: cartValue,
        items,
      },
    });
  }, [isHydrated, state.items]);

  return null;
}
