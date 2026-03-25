import { expect, test, type Page } from "@playwright/test";

import {
  getNotificationsForOrder,
  waitForEmailActionLink,
  waitForLatestOrderByCustomerEmail
} from "./support/db";
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

async function registerStorefrontCustomer(page: Page, customer: ReturnType<typeof buildTestCustomer>) {
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
}

async function verifyCustomerEmail(page: Page, email: string) {
  const verifyLink = await waitForEmailActionLink(email, "verify_email", 40_000);
  await gotoWithRetry(page, verifyLink.url);
  await expect(
    page.getByText(/correo electrónico fue verificado|email verified/i).first()
  ).toBeVisible({ timeout: 20_000 });
}

async function addSimpleProductFromDetail(page: Page, slug: string) {
  await gotoWithRetry(page, `/product/${slug}`);
  await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible();
  await page.getByTestId("product-detail-add-to-cart").click();
}

async function createCustomerCashOrder(
  page: Page,
  productId: number,
  customer: ReturnType<typeof buildTestCustomer>
) {
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
    items: [
      {
        productId,
        quantity: 1
      }
    ],
    notes: "QA account notifications flow",
    shippingOptionId: shippingOptions[0]!.id,
    fulfillmentMode: "home_delivery",
    currency: "UYU"
  });

  const order = await waitForLatestOrderByCustomerEmail(customer.email);
  await expect
    .poll(async () => (await getNotificationsForOrder(order.uuid)).filter((row) => row.audience === "CUSTOMER").length, {
      message: `waiting for customer notifications for order ${order.uuid}`
    })
    .toBeGreaterThan(0);

  return order;
}

async function openNotificationsPanel(page: Page) {
  await expect(page.getByTestId("customer-notifications-toggle")).toBeVisible();
  const panel = page.getByTestId("customer-notifications-panel");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByTestId("customer-notifications-toggle").click();
    try {
      await expect(panel).toBeVisible({ timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(300);
    }
  }
}

test.describe("customer notifications and order detail flows", () => {
  test.setTimeout(60_000);

  test("navigates from account notifications to the order detail using the public uuid and renders the structured address", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page, "UYU");

    const customer = buildTestCustomer(Date.now() + 4000);
    await registerStorefrontCustomer(page, customer);
    await verifyCustomerEmail(page, customer.email);

    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const order = await createCustomerCashOrder(page, simple.id, customer);

    await gotoWithRetry(page, "/account/profile");
    await openNotificationsPanel(page);

    const matchingNotification = page
      .locator('[data-testid^="customer-notification-item-"]')
      .filter({ hasText: order.uuid })
      .first();

    await expect(matchingNotification).toBeVisible({ timeout: 20_000 });
    await matchingNotification.click();

    await page.waitForURL(new RegExp(`/account/orders/${order.uuid}$`), { timeout: 20_000 });
    await expect(page.getByTestId("account-order-display-id")).toContainText(order.uuid);
    await expect(page.getByTestId("account-order-shipping-address")).toContainText("Montevideo");
    await expect(page.getByTestId("account-order-shipping-address")).toContainText("Aguada");
    await expect(page.getByTestId("account-order-shipping-address")).toContainText("Uruguay");
  });

  test("allows deleting one notification and then clearing the remaining customer notifications", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page, "UYU");

    const customer = buildTestCustomer(Date.now() + 5000);
    await registerStorefrontCustomer(page, customer);
    await verifyCustomerEmail(page, customer.email);

    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    await createCustomerCashOrder(page, simple.id, customer);
    await createCustomerCashOrder(page, simple.id, customer);

    await gotoWithRetry(page, "/account/profile");
    await openNotificationsPanel(page);

    const items = page.locator('[data-testid^="customer-notification-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 20_000 });
    const initialCount = await items.count();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    await page.locator('[data-testid^="customer-notification-delete-"]').first().click();
    await expect
      .poll(async () => items.count(), {
        message: "waiting for one notification to be deleted"
      })
      .toBe(initialCount - 1);

    await page.getByTestId("customer-notifications-delete-all").click();
    await expect(page.getByTestId("customer-notifications-empty")).toBeVisible();
  });
});
