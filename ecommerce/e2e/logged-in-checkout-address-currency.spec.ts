import { expect, test, type Page } from "@playwright/test";

import {
  getCustomerAddressesByEmail,
  getEmailLogsForOrder,
  getOrderAddressByUuid,
  waitForEmailActionLink,
  waitForLatestOrderByCustomerEmail
} from "./support/db";
import { buildTestCustomer } from "./support/factories";
import { fetchProductDetail } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";
const PARAMETRIC_PRODUCT_SLUG = "ventana-corrediza-20-natural-3mm-1800x1000";
const CART_STORAGE_KEY = "storefront.cart.v1";

async function bootstrapStorefrontContext(page: Page, currency: "USD" | "UYU") {
  await page.addInitScript((selectedCurrency) => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", selectedCurrency);
  }, currency);
}

async function registerStorefrontCustomer(page: Page, customer: ReturnType<typeof buildTestCustomer>) {
  await page.goto("/account/register");
  await page.getByTestId("auth-register-first-name").fill(customer.firstName);
  await page.getByTestId("auth-register-last-name").fill(customer.lastName);
  await page.getByTestId("auth-register-email").fill(customer.email);
  await page.getByTestId("auth-register-phone").fill(customer.phone);
  await page.getByTestId("auth-register-password").fill(customer.password);
  await page.getByTestId("auth-register-confirm-password").fill(customer.password);
  await page.getByTestId("auth-register-agreement").check();
  await page.getByTestId("auth-register-submit").click();
  await page.waitForURL("**/", { timeout: 20_000 });
}

async function addSimpleProductFromDetail(page: Page, slug: string) {
  await page.goto(`/product/${slug}`);
  await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible();
  await page.getByTestId("product-detail-add-to-cart").click();
}

async function addParametricProductFromShop(page: Page, name: string, slug: string) {
  await page.goto(`/shop?search=${encodeURIComponent(name)}`);
  await expect(page.getByTestId(`product-card-add-${slug}`)).toBeVisible();
  await page.getByTestId(`product-card-add-${slug}`).click();
}

function cartLineLocator(page: Page) {
  return page.locator(
    '[data-testid^="cart-line-"]:not([data-testid*="-increase-"]):not([data-testid*="-decrease-"]):not([data-testid*="-quantity-"]):not([data-testid*="-remove-"])'
  );
}

async function waitForCartItemCount(page: Page, expectedCount: number) {
  await expect
    .poll(async () => {
      return page.evaluate((storageKey) => {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : { items: [] };
        return Array.isArray(parsed?.items) ? parsed.items.length : 0;
      }, CART_STORAGE_KEY);
    })
    .toBe(expectedCount);
}

async function expectCartLineCount(page: Page, count: number) {
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  const lines = cartLineLocator(page);
  await expect(lines).toHaveCount(count, { timeout: 20_000 });
}

async function ensureParametricCartItemAdded(
  page: Page,
  name: string,
  slug: string,
  expectedCount: number
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentCount = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : { items: [] };
      return Array.isArray(parsed?.items) ? parsed.items.length : 0;
    }, CART_STORAGE_KEY);
    if (currentCount >= expectedCount) {
      return;
    }
    await addParametricProductFromShop(page, name, slug);
    await waitForCartItemCount(page, expectedCount);
  }

  await expectCartLineCount(page, expectedCount);
}

async function fillLoggedInCheckoutAddress(
  page: Page,
  customer: ReturnType<typeof buildTestCustomer>
) {
  await page.goto("/checkout");
  await expect(page.locator('input[name="street"]')).toBeVisible({ timeout: 20_000 });

  if ((await page.locator('input[name="firstName"]').inputValue()).trim().length === 0) {
    await page.locator('input[name="firstName"]').fill(customer.firstName);
  }
  if ((await page.locator('input[name="lastName"]').inputValue()).trim().length === 0) {
    await page.locator('input[name="lastName"]').fill(customer.lastName);
  }
  if ((await page.locator('input[name="email"]').inputValue()).trim().length === 0) {
    await page.locator('input[name="email"]').fill(customer.email);
  }
  if ((await page.locator('input[name="phone"]').inputValue()).trim().length === 0) {
    await page.locator('input[name="phone"]').fill(customer.phone);
  }

  await page.locator('input[name="street"]').fill("Norberto Ortiz");
  await expect(page.locator('input[name="street"]')).toHaveValue("Norberto Ortiz");
  await page.locator('input[name="number"]').fill("4086");
  await page.locator('input[name="corner"]').fill("Santa Ana");
  await page.locator('input[name="apartment"]').fill("Porton verde");

  await page.getByLabel(/^Barrio$/i).click();
  await page.getByRole("option", { name: /^Aguada$/i }).click();

  await page.getByTestId("checkout-continue-to-payment").click();
  await page.waitForURL(/\/payment$/, { timeout: 20_000 });
}

async function completeCashOrder(page: Page) {
  await expect(page.getByTestId("payment-method-cod")).toBeVisible();
  await page.getByTestId("payment-method-cod").click();
  await page.getByTestId("payment-continue-to-review").click();
  try {
    await page.waitForURL(/\/review$/, { timeout: 5_000 });
  } catch {
    await page.getByTestId("payment-continue-to-review").click();
    await page.waitForURL(/\/review$/, { timeout: 20_000 });
  }
  await expect(page.getByTestId("review-place-order")).toBeVisible();
  await page.getByTestId("review-place-order").click();
  await page.waitForURL(/\/payment\/success\?method=cod.*/, { timeout: 20_000 });
  await expect(page.getByText(/pedido recibido/i).first()).toBeVisible({ timeout: 20_000 });
}

test.describe("logged in checkout persistence and customer email gating", () => {
  test.setTimeout(60_000);

  test("saves a single address, keeps UYU on the order and skips customer order emails while email is unverified", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page, "UYU");

    const customer = buildTestCustomer(Date.now() + 2000);
    await registerStorefrontCustomer(page, customer);
    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const parametric = await fetchProductDetail(request, PARAMETRIC_PRODUCT_SLUG);

    await addSimpleProductFromDetail(page, simple.slug);
    await waitForCartItemCount(page, 1);
    await ensureParametricCartItemAdded(page, parametric.name, parametric.slug, 2);
    await fillLoggedInCheckoutAddress(page, customer);
    await completeCashOrder(page);

    const order = await waitForLatestOrderByCustomerEmail(customer.email);
    expect(order.itemCount).toBe(2);
    expect(order.orderCurrency).toBe("UYU");

    const addresses = await getCustomerAddressesByEmail(customer.email);
    expect(addresses).toHaveLength(1);
    expect(addresses[0]?.city).toBe("Montevideo");
    expect(addresses[0]?.department).toBe("Montevideo");
    expect(addresses[0]?.neighborhood).toBe("Aguada");
    expect(addresses[0]?.country).toBe("Uruguay");

    const orderAddress = await getOrderAddressByUuid(order.uuid);
    expect(orderAddress?.shippingCity).toBe("Montevideo");
    expect(orderAddress?.shippingDepartment).toBe("Montevideo");
    expect(orderAddress?.shippingNeighborhood).toBe("Aguada");
    expect(orderAddress?.shippingCountry).toBe("Uruguay");

    await expect
      .poll(async () => (await getEmailLogsForOrder(order.uuid)).length, {
        message: `waiting for order emails for ${order.uuid}`
      })
      .toBeGreaterThan(0);

    const emails = await getEmailLogsForOrder(order.uuid);
    expect(emails.some((email) => email.recipientType === "CUSTOMER")).toBeFalsy();
  });

  test("sends customer order emails only after the email has been verified", async ({ page, request }) => {
    await bootstrapStorefrontContext(page, "UYU");

    const customer = buildTestCustomer(Date.now() + 3000);
    await registerStorefrontCustomer(page, customer);
    const verifyLink = await waitForEmailActionLink(customer.email, "verify_email");

    await page.goto(verifyLink.url);
    await expect(
      page.getByText(/correo electrónico fue verificado|email verified/i).first()
    ).toBeVisible({
      timeout: 20_000
    });

    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);

    await addSimpleProductFromDetail(page, simple.slug);
    await waitForCartItemCount(page, 1);
    await fillLoggedInCheckoutAddress(page, customer);
    await completeCashOrder(page);

    const order = await waitForLatestOrderByCustomerEmail(customer.email);

    await expect
      .poll(
        async () => (await getEmailLogsForOrder(order.uuid)).filter((email) => email.recipientType === "CUSTOMER").length,
        {
          message: `waiting for customer order email for ${order.uuid}`
        }
      )
      .toBeGreaterThan(0);
  });
});
