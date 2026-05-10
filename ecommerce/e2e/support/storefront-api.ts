import { expect, type APIRequestContext } from "@playwright/test";

import { storefrontApiBaseUrl } from "./env";
import type { TestCustomer } from "./factories";
import type { CreateOrderPayload } from "@/types/storefront";
import type { InventoryStatus } from "@/types/storefront";

type ProductSummary = {
  id: number;
  slug: string;
  name: string;
  mode?: string | null;
  inventoryStatus?: InventoryStatus;
  routePath?: string | null;
};

export type ProductDetailSummary = ProductSummary & {
  price?: {
    amount: number;
    currency: string;
  } | null;
  inventoryStatus: InventoryStatus;
  publishedParametricOptions?: {
    defaultConfiguration?: Record<string, unknown> | null;
    defaultVariantKey?: string | null;
  } | null;
};

export type ShippingOptionSummary = {
  id: number;
  name: string;
  deliveryFees: number;
  estimatedMin: number | null;
  estimatedMax: number | null;
};

export async function registerCustomer(request: APIRequestContext, customer: TestCustomer) {
  const response = await request.post(`${storefrontApiBaseUrl}/auth/register`, {
    data: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      password: customer.password,
      locale: "es"
    }
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function fetchFirstCatalogProduct(request: APIRequestContext): Promise<ProductSummary> {
  const response = await request.get(`${storefrontApiBaseUrl}/products?page=1&pageSize=1`);
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  const product = payload?.data?.[0];

  if (!product?.id || !product?.slug) {
    throw new Error("Storefront catalog did not return a usable product for E2E.");
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name ?? product.slug,
    mode: product.mode ?? null
  };
}

export async function fetchFirstInStockCatalogProduct(request: APIRequestContext): Promise<ProductSummary> {
  const response = await request.get(`${storefrontApiBaseUrl}/products?page=1&pageSize=100`);
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  const products = Array.isArray(payload?.data) ? (payload.data as ProductSummary[]) : [];
  const product =
    products.find((item) => item?.inventoryStatus && item.inventoryStatus !== "out-of-stock") ?? products[0];

  if (!product?.id || !product?.slug) {
    throw new Error("Storefront catalog did not return a usable in-stock product for E2E.");
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name ?? product.slug,
    mode: product.mode ?? null,
    inventoryStatus: product.inventoryStatus ?? undefined,
    routePath: product.routePath ?? null,
  };
}

export async function fetchProductDetail(
  request: APIRequestContext,
  slug: string
): Promise<ProductDetailSummary> {
  const response = await request.get(`${storefrontApiBaseUrl}/products/${slug}`);
  expect(response.ok()).toBeTruthy();

  const product = await response.json();
  if (!product?.id || !product?.slug) {
    throw new Error(`Storefront product detail did not return a usable payload for slug ${slug}.`);
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name ?? product.slug,
    mode: product.mode ?? null,
    price: product.price ?? null,
    inventoryStatus: product.inventoryStatus ?? "in-stock",
    publishedParametricOptions: product.publishedParametricOptions ?? null
  };
}

export async function previewCheckout(
  request: APIRequestContext,
  payload: CreateOrderPayload
) {
  const response = await request.post(`${storefrontApiBaseUrl}/checkout/preview`, {
    data: payload
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function createOrder(
  request: APIRequestContext,
  payload: CreateOrderPayload
) {
  const response = await request.post(`${storefrontApiBaseUrl}/orders`, {
    data: payload
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function listShippingOptions(request: APIRequestContext): Promise<ShippingOptionSummary[]> {
  const response = await request.get(`${storefrontApiBaseUrl}/shipping-options`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function createMercadoPagoPreference(
  request: APIRequestContext,
  payload: {
    amount: number;
    currency: string;
    description?: string;
    cartId?: string;
    checkoutToken?: string;
    payerEmail?: string;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
    checkoutSnapshot: CreateOrderPayload;
  }
) {
  const response = await request.post(`${storefrontApiBaseUrl}/payments/mercadopago/preference`, {
    data: payload
  });
  if (!response.ok()) {
    throw new Error(
      `Mercado Pago preference creation failed with status ${response.status}: ${await response.text()}`
    );
  }
  return response.json();
}

export async function resolveMercadoPagoPayment(
  request: APIRequestContext,
  payload: {
    externalPaymentId: string;
    cartId?: string;
    checkoutToken?: string;
    payerEmail?: string;
  }
) {
  const response = await request.post(`${storefrontApiBaseUrl}/payments/mercadopago/resolve`, {
    data: payload
  });
  if (!response.ok()) {
    throw new Error(
      `Mercado Pago payment resolution failed with status ${response.status}: ${await response.text()}`
    );
  }
  return response.json();
}
