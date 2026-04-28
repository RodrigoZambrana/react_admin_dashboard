import { expect, test } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { createOrder, fetchProductDetail, listShippingOptions } from "./support/storefront-api";
import { storefrontApiBaseUrl } from "./support/env";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

async function loginCustomer(page, customer) {
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("auth-login-form")).toBeHidden({ timeout: 20_000 });
}

test("order detail hides review cta until the order is eligible", async ({ page, request }) => {
  const customer = buildTestCustomer(Date.now() + 21_000);
  const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
  const shippingOptions = await listShippingOptions(request);

  expect(shippingOptions.length).toBeGreaterThan(0);

  const registerResponse = await request.post(`${storefrontApiBaseUrl}/auth/register`, {
    data: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      password: customer.password,
      locale: "es",
    },
  });
  expect(registerResponse.ok()).toBeTruthy();

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
    items: [{ productId: product.id, quantity: 1 }],
    currency: "UYU",
  });

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await loginCustomer(page, customer);

  await page.goto(`http://localhost:3000/account/orders/${order.uuid}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByTestId(`write-review-button-${product.id}`)).toHaveCount(0);
});
