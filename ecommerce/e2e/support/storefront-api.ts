import { expect, type APIRequestContext } from "@playwright/test";

import { storefrontApiBaseUrl } from "./env";
import type { TestCustomer } from "./factories";

type ProductSummary = {
  id: number;
  slug: string;
  name: string;
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
    name: product.name ?? product.slug
  };
}
