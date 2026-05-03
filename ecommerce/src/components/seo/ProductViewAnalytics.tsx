"use client";

import type Product from "@models/product.model";
import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { buildCanonicalAnalyticsContext } from "@/lib/analytics/product-context";

type ProductViewAnalyticsProps = {
  product: Product;
};

export default function ProductViewAnalytics({ product }: ProductViewAnalyticsProps) {
  useEffect(() => {
    void trackEvent({
      event_name: "view_item",
      event_category: "ecommerce",
      tenant_id: env.clientSlug,
      page_type: "product",
      component_type: "product_detail",
      component_id: "product_detail_view",
      cta_id: null,
      cta_name: null,
      cta_type: null,
      cta_context: null,
      cta_location: null,
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        product_id: product.id,
        product_slug: product.slug,
        price: product.salePrice ?? product.price ?? null,
        currency: product.currency ?? null,
        ...buildCanonicalAnalyticsContext({
          canonicalConfiguration: product.canonicalConfiguration ?? null,
          configuration: product.configuration ?? null
        }),
      },
      data: {
        product_id: product.id,
        product_slug: product.slug,
        price: product.salePrice ?? product.price ?? null,
        currency: product.currency ?? null,
        ...buildCanonicalAnalyticsContext({
          canonicalConfiguration: product.canonicalConfiguration ?? null,
          configuration: product.configuration ?? null
        }),
      },
    });
  }, [product]);

  return null;
}
