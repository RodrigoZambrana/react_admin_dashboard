import { expect, test, type Page } from "@playwright/test";

import { waitForLatestOrderByCustomerEmail } from "./support/db";
import { buildTestCustomer } from "./support/factories";
import { createOrder, fetchProductDetail, listShippingOptions } from "./support/storefront-api";
import { storefrontApiBaseUrl } from "./support/env";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

async function gotoWithRetry(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }
}

async function bootstrapStorefrontContext(page: Page, currency: "USD" | "UYU" = "UYU") {
  await page.addInitScript((selectedCurrency) => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", selectedCurrency);
  }, currency);
}

async function registerAndLoginCustomer(page: Page, customer: ReturnType<typeof buildTestCustomer>) {
  const response = await page.request.post(`${storefrontApiBaseUrl}/auth/register`, {
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

  await gotoWithRetry(page, "/");
  await page.getByTestId("header-account-button").click();
  await expect(page.getByTestId("auth-login-form")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("auth-login-identifier").fill(customer.email);
  await page.getByTestId("auth-login-password").fill(customer.password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("auth-login-form")).toBeHidden({ timeout: 20_000 });
}

async function createCustomerCashOrder(page: Page, productId: number, customer: ReturnType<typeof buildTestCustomer>) {
  const shippingOptions = await listShippingOptions(page.request);
  expect(shippingOptions.length).toBeGreaterThan(0);

  await createOrder(page.request, {
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      locale: "es"
    },
    shippingAddress: {
      line1: "Norberto Ortiz 4086",
      line2: "Porton verde, Santa Ana",
      street: "Norberto Ortiz",
      number: "4086",
      corner: "Santa Ana",
      apartment: "Porton verde",
      city: "Montevideo",
      department: "Montevideo",
      neighborhood: "Aguada",
      state: "Montevideo",
      zip: "11000",
      country: "Uruguay"
    },
    items: [{ productId, quantity: 1 }],
    notes: "QA account order list flow",
    shippingOptionId: shippingOptions[0]!.id,
    fulfillmentMode: "home_delivery",
    currency: "UYU"
  });
}

test("lists the authenticated customer's orders and opens the detail page from the row", async ({
  page,
  request
}) => {
  await bootstrapStorefrontContext(page, "UYU");

  const customer = buildTestCustomer(Date.now() + 5001);
  const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);

  await registerAndLoginCustomer(page, customer);
  await createCustomerCashOrder(page, simple.id, customer);
  const order = await waitForLatestOrderByCustomerEmail(customer.email);

  await gotoWithRetry(page, "/account/orders");
  await expect(page.getByText(/my orders|mis pedidos/i).first()).toBeVisible({ timeout: 20_000 });

  await expect(page.getByText(`#${order.uuid}`, { exact: false }).first()).toBeVisible({
    timeout: 20_000
  });
  await page.getByText(`#${order.uuid}`, { exact: false }).first().click();

  await page.waitForURL(/\/account\/orders\/.+$/, { timeout: 20_000 });
  await expect(page.getByTestId("account-order-display-id")).toBeVisible();
  await expect(page.getByTestId("account-order-shipping-address")).toContainText("Montevideo");
  await expect(page.getByTestId("account-order-shipping-address")).toContainText("Aguada");
});
