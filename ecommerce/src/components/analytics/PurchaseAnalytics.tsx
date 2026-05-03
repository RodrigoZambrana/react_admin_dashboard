"use client";

import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { getAnalyticsContext } from "@/lib/analytics/session";
import { buildCanonicalAnalyticsContext } from "@/lib/analytics/product-context";
import type { CartLineItem } from "@/state/cart-context";
import type { OrderSummary } from "@/types/storefront";

type PurchaseAnalyticsProps = {
  orderState: "idle" | "processing" | "success" | "error";
  createdOrder: OrderSummary | null;
  purchaseItemsSnapshot: CartLineItem[];
  cartItems: CartLineItem[];
};

export default function PurchaseAnalytics({
  orderState,
  createdOrder,
  purchaseItemsSnapshot,
  cartItems
}: PurchaseAnalyticsProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }
    if (!createdOrder || orderState === "error") {
      return;
    }

    const context = getAnalyticsContext();
    const itemsSource = purchaseItemsSnapshot.length > 0 ? purchaseItemsSnapshot : cartItems;
    void trackEvent({
      event_name: "purchase",
      event_category: "conversion",
      tenant_id: env.clientSlug,
      page_type: resolvePageType(context.path),
      component_type: "checkout",
      component_id: "checkout_purchase",
      cta_id: "checkout.purchase.confirm",
      cta_name: "purchase",
      cta_type: "primary",
      cta_context: "checkout",
      cta_location: "purchase_success",
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        order_id: createdOrder.uuid,
        value: createdOrder.summary.grandTotal.amount,
        currency: createdOrder.summary.grandTotal.currency,
        items_count: createdOrder.items.length,
        items: itemsSource.map(({ product, quantity }) => ({
          ...product,
          quantity,
          ...buildCanonicalAnalyticsContext({
            canonicalConfiguration: product.canonicalConfiguration ?? null,
            configuration: product.configuration ?? null
          })
        })),
      },
      data: {
        order_id: createdOrder.uuid,
        value: createdOrder.summary.grandTotal.amount,
        currency: createdOrder.summary.grandTotal.currency,
        items_count: createdOrder.items.length,
        items: itemsSource.map(({ product, quantity }) => ({
          ...product,
          quantity,
          ...buildCanonicalAnalyticsContext({
            canonicalConfiguration: product.canonicalConfiguration ?? null,
            configuration: product.configuration ?? null
          })
        })),
      },
    });
    trackedRef.current = true;
  }, [cartItems, createdOrder, orderState, purchaseItemsSnapshot]);

  return null;
}
