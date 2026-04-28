import type { StorefrontConfig, ProductSummary, CheckoutLineItem, OrderSummary } from "@/types/storefront";
import { resolvePublicPricing, type PublicPricingSource } from "@/lib/seo/public-pricing";

export type AnalyticsEvent =
  | {
      event: "view_item";
      ecommerce: {
        currency: string;
        value: number;
        items: Array<Record<string, unknown>>;
      };
    }
  | {
      event: "add_to_cart";
      ecommerce: {
        currency: string;
        value: number;
        items: Array<Record<string, unknown>>;
      };
    }
  | {
      event: "purchase";
      ecommerce: {
        transaction_id?: string;
        currency: string;
        value: number;
        items: Array<Record<string, unknown>>;
      };
    }
  | Record<string, unknown>;

export type AnalyticsRuntime = {
  analytics?: string | null;
  tagManager?: string | null;
  ads?: string | null;
};

type AnalyticsProductLike = PublicPricingSource & {
  id?: number | string;
  productId?: number | string;
  name?: string;
  title?: string;
  quantity?: number;
  variantId?: number | null;
  variantKey?: string | null;
};

export const resolveAnalyticsRuntime = (config: StorefrontConfig): AnalyticsRuntime => ({
  analytics: config.integrations?.google?.analytics?.measurementId?.trim() || null,
  tagManager: config.integrations?.google?.tagManager?.enabled
    ? config.integrations?.google?.tagManager?.containerId?.trim() || null
    : null,
  ads: config.integrations?.google?.ads?.enabled
    ? config.integrations?.google?.ads?.conversionId?.trim() || null
    : null,
});

const pushToDataLayer = (payload: AnalyticsEvent) => {
  if (typeof window === "undefined") return;
  const globalWindow = window as Window & { dataLayer?: unknown[] };
  const dataLayer = globalWindow.dataLayer ?? [];
  globalWindow.dataLayer = dataLayer;
  dataLayer.push(payload);
};

export const trackAnalyticsEvent = (event: AnalyticsEvent) => {
  pushToDataLayer(event);
};

const mapItem = (
  item: AnalyticsProductLike | CheckoutLineItem,
) => {
  const pricing = resolvePublicPricing({
    currency: "currency" in item ? item.currency ?? undefined : undefined,
    price: "price" in item ? item.price : undefined,
    salePrice: "salePrice" in item ? item.salePrice ?? undefined : undefined,
    basePrice: "basePrice" in item ? item.basePrice ?? undefined : undefined,
  });
  const quantity = "quantity" in item && typeof item.quantity === "number" ? item.quantity : 1;
  const itemId =
    "productId" in item && item.productId !== undefined
      ? String(item.productId)
      : "id" in item && item.id !== undefined
        ? String(item.id)
        : "";
  return {
    item_id: itemId,
    item_name:
      "name" in item && item.name
        ? item.name
        : "title" in item && item.title
          ? item.title
          : undefined,
    quantity,
    price: pricing.publicPrice.amount,
    currency: pricing.currency,
    item_variant: "variantKey" in item ? item.variantKey ?? undefined : undefined,
    item_variant_id: "variantId" in item ? item.variantId ?? undefined : undefined,
  };
};

export const trackViewItem = (
  product: AnalyticsProductLike,
  currency?: string,
) => {
  const pricing = resolvePublicPricing({
    currency: "currency" in product ? product.currency ?? undefined : undefined,
    price: "price" in product ? product.price : undefined,
    salePrice: "salePrice" in product ? product.salePrice ?? undefined : undefined,
    basePrice: "basePrice" in product ? product.basePrice ?? undefined : undefined,
  });
  trackAnalyticsEvent({
    event: "view_item",
    ecommerce: {
      currency: currency ?? pricing.currency,
      value: pricing.publicPrice.amount,
      items: [mapItem(product)],
    },
  });
};

export const trackAddToCart = (
  product: AnalyticsProductLike,
  quantity = 1,
) => {
  const pricing = resolvePublicPricing({
    currency: "currency" in product ? product.currency ?? undefined : undefined,
    price: "price" in product ? product.price : undefined,
    salePrice: "salePrice" in product ? product.salePrice ?? undefined : undefined,
    basePrice: "basePrice" in product ? product.basePrice ?? undefined : undefined,
  });
  trackAnalyticsEvent({
    event: "add_to_cart",
    ecommerce: {
      currency: pricing.currency,
      value: pricing.publicPrice.amount * quantity,
      items: [mapItem({ ...product, productId: product.productId ?? product.id, quantity })],
    },
  });
};

export const trackPurchase = (order: OrderSummary) => {
  trackAnalyticsEvent({
    event: "purchase",
    ecommerce: {
      transaction_id: order.uuid,
      currency: order.summary.grandTotal.currency,
      value: order.summary.grandTotal.amount,
      items: order.items.map((item) => mapItem(item)),
    },
  });
};
