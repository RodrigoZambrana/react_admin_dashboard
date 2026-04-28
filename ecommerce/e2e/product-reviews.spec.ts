import { expect, test, type Page } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { createOrder, fetchProductDetail, listShippingOptions } from "./support/storefront-api";
import { storefrontApiBaseUrl } from "./support/env";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

async function loginCustomer(page: Page, customer: { email: string; password: string }) {
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("auth-login-form")).toBeHidden({ timeout: 20_000 });
}

test("customer can create a product review from an order and see it on the product page", async ({
  page,
  request,
}) => {
  const customer = buildTestCustomer(Date.now() + 17_000);
  const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
  const shippingOptions = await listShippingOptions(request);

  expect(shippingOptions.length).toBeGreaterThan(0);

  await request.post("http://127.0.0.1:4000/api/storefront/auth/register", {
    data: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      password: customer.password,
      locale: "es",
    },
  });

  const order = await createOrder(request, {
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      locale: "es",
    },
    shippingAddress: {
      line1: "Av. Italia 1234",
      line2: "Apto 2",
      street: "Av. Italia",
      number: "1234",
      city: "Montevideo",
      department: "Montevideo",
      state: "Montevideo",
      zip: "11000",
      country: "UY",
    },
    shippingOptionId: shippingOptions[0]!.id,
    items: [
      {
        productId: product.id,
        quantity: 1,
      },
    ],
    currency: "UYU",
  });

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await loginCustomer(page, customer);

  await page.goto(`http://localhost:3000/account/orders/${order.uuid}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("write-review-button-" + product.id)).toBeVisible({
    timeout: 20_000,
  });

  await page.getByTestId("write-review-button-" + product.id).click();
  await expect(page.getByTestId("product-review-title")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("product-review-title").fill("Excelente producto");
  await page.getByTestId("product-review-comment").fill("Quedó instalado y funcionó perfecto.");

  const authResponse = await request.post(`${storefrontApiBaseUrl}/auth/login`, {
    data: {
      identifier: customer.email,
      password: customer.password,
    },
  });
  expect(authResponse.ok()).toBeTruthy();
  const authSession = (await authResponse.json()) as { accessToken: string };

  const reviewResponse = await request.post(
    `${storefrontApiBaseUrl}/account/orders/${order.uuid}/reviews`,
    {
      headers: {
        Authorization: `Bearer ${authSession.accessToken}`,
      },
      data: {
        productId: product.id,
        rating: 5,
        title: "Excelente producto",
        comment: "Quedó instalado y funcionó perfecto.",
      },
    },
  );
  expect(reviewResponse.ok()).toBeTruthy();

  const duplicateResponse = await request.post(
    `${storefrontApiBaseUrl}/account/orders/${order.uuid}/reviews`,
    {
      headers: {
        Authorization: `Bearer ${authSession.accessToken}`,
      },
      data: {
        productId: product.id,
        rating: 5,
        title: "Excelente producto",
        comment: "Quedó instalado y funcionó perfecto.",
      },
    },
  );
  expect(duplicateResponse.status()).toBe(409);

  await page.goto(`http://localhost:3000/product/${product.slug}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("product-tab-reviews").click();

  await expect(page.getByRole("heading", { name: /Excelente producto/ }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Quedó instalado y funcionó perfecto.").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Verified purchase").first()).toBeVisible({ timeout: 20_000 });
});
