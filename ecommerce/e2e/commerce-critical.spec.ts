import { expect, test, type Page } from "@playwright/test";

import { updatePaymentStatus } from "./support/admin-api";
import {
  getEmailLogsForOrder,
  getLatestPaymentForOrder,
  getNotificationsForOrder,
  getLatestTimelineEventsForOrder,
  waitForLatestOrderByCustomerEmail
} from "./support/db";
import { buildTestCustomer, type TestCustomer } from "./support/factories";
import { fetchProductDetail } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";
const PARAMETRIC_PRODUCT_SLUG = "ventana-corrediza-20-natural-3mm-1800x1000";
const CART_STORAGE_KEY = "storefront.cart.v1";

function cartLineLocator(page: Page) {
  return page.locator(
    '[data-testid^="cart-line-"]:not([data-testid*="-increase-"]):not([data-testid*="-decrease-"])'
  );
}

async function bootstrapStorefrontContext(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "USD");
  });
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

async function openParametricDetailFromShop(page: Page, name: string, slug: string) {
  await page.goto(`/shop?search=${encodeURIComponent(name)}`);
  const detailHref = await page.locator(`a[href*="/product/${slug}"]`).first().getAttribute("href");
  expect(detailHref).toBeTruthy();
  await page.goto(detailHref!);
  await expect(page).toHaveURL(new RegExp(`/product/${slug}`));
}

async function fillGuestCheckout(page: Page, customer: TestCustomer) {
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle");

  await page.locator('input[name="firstName"]').fill(customer.firstName);
  await page.locator('input[name="lastName"]').fill(customer.lastName);
  await page.locator('input[name="email"]').fill(customer.email);
  await page.locator('input[name="phone"]').fill(customer.phone);
  await page.locator('input[name="street"]').fill("Av. Italia");
  await page.locator('input[name="number"]').fill("1234");
  await page.locator('input[name="corner"]').fill("Comercio");
  await page.locator('input[name="apartment"]').fill("101");
  await page.getByLabel(/^Barrio$/i).click();
  await page.getByText(/^Aguada$/i).click();

  await page.getByTestId("checkout-continue-to-payment").click();
  await expect(page).toHaveURL(/\/payment$/, { timeout: 15_000 });
}

async function placeGuestCashOrder(
  page: Page,
  customer: TestCustomer,
  simpleSlug: string,
  parametric: { name: string; slug: string }
) {
  await addSimpleProductFromDetail(page, simpleSlug);
  await addParametricProductFromShop(page, parametric.name, parametric.slug);

  await page.goto("/cart");
  await fillGuestCheckout(page, customer);

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
  await expect(page.getByText(/pedido recibido/i).first()).toBeVisible();

  const order = await waitForLatestOrderByCustomerEmail(customer.email);
  await expect
    .poll(async () => getLatestPaymentForOrder(order.uuid), {
      message: `waiting for registered payment for order ${order.uuid}`
    })
    .not.toBeNull();
  const payment = await getLatestPaymentForOrder(order.uuid);

  return {
    order,
    payment: payment!
  };
}

test.describe("critical storefront commerce flows", () => {
  test.setTimeout(60_000);

  test("keeps a single cart line for the same published parametric base variant added from shop and detail", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page);

    const parametric = await fetchProductDetail(request, PARAMETRIC_PRODUCT_SLUG);
    expect(parametric.mode).toBe("parametric");

    await addParametricProductFromShop(page, parametric.name, parametric.slug);
    await openParametricDetailFromShop(page, parametric.name, parametric.slug);

    await expect(page.getByText(/sin mosquitero|without mosquito net/i).first()).toBeVisible();
    await expect(page.getByText(/sin persiana|without shutter/i).first()).toBeVisible();
    await expect(page.getByTestId("product-detail-increase")).toBeVisible();

    await page.getByTestId("product-detail-increase").click();
    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    const cartState = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : { items: [] };
    }, CART_STORAGE_KEY);

    const matchingItems = (cartState?.items ?? []).filter(
      (item: { product?: { slug?: string } }) => item.product?.slug === parametric.slug
    );

    expect(matchingItems).toHaveLength(1);
    expect(matchingItems[0]?.quantity).toBe(2);
    await expect(cartLineLocator(page)).toHaveCount(1);
  });

  test("creates a coherent mixed guest cash order and keeps the payment registered until admin confirmation", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page);

    const customer = buildTestCustomer();
    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const parametric = await fetchProductDetail(request, PARAMETRIC_PRODUCT_SLUG);

    const { order, payment } = await placeGuestCashOrder(page, customer, simple.slug, {
      name: parametric.name,
      slug: parametric.slug
    });

    expect(order.itemCount).toBe(2);
    expect(order.orderCurrency).toBe("USD");
    expect(order.itemNames.some((name) => name.includes(simple.name))).toBeTruthy();
    expect(order.itemNames.some((name) => name.includes(parametric.name))).toBeTruthy();

    expect(payment.status).toBe("REGISTERED");
    expect(payment.currency).toBe("USD");
    expect((payment.method ?? "").toLowerCase()).toMatch(/cash|efectivo/);

    const timeline = await getLatestTimelineEventsForOrder(order.uuid);
    expect(timeline.some((event) => event.type === "PAYMENT_WAITING")).toBeTruthy();
    expect(timeline.some((event) => event.type === "PAYMENT_FULL")).toBeFalsy();

    await expect
      .poll(
        async () =>
          (await getNotificationsForOrder(order.uuid)).filter((row) => row.eventType === "ORDER_RECEIVED").length,
        {
          message: `waiting for order received notifications for ${order.uuid}`
        }
      )
      .toBeGreaterThanOrEqual(2);

    const notifications = await getNotificationsForOrder(order.uuid);
    expect(notifications.some((row) => row.eventType === "PAYMENT_RECEIVED")).toBeFalsy();
    expect(notifications.some((row) => row.eventType === "ORDER_STATUS_CHANGED")).toBeFalsy();

    await expect
      .poll(
        async () => (await getEmailLogsForOrder(order.uuid)).filter((row) => row.category === "ORDERS").length,
        {
          message: `waiting for order received emails for ${order.uuid}`
        }
      )
      .toBeGreaterThanOrEqual(1);

    const emails = await getEmailLogsForOrder(order.uuid);
    const orderEmails = emails.filter((row) => row.category === "ORDERS");
    expect(orderEmails).toHaveLength(1);
    expect(orderEmails.every((row) => row.recipientType === "ADMIN")).toBeTruthy();
    expect(emails.some((row) => row.category === "PAYMENTS")).toBeFalsy();
  });

  test("allows admin to confirm registered cash payments with consistent persistence", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page);

    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const parametric = await fetchProductDetail(request, PARAMETRIC_PRODUCT_SLUG);

    const confirmCustomer = buildTestCustomer(Date.now());
    const confirmOrder = await placeGuestCashOrder(page, confirmCustomer, simple.slug, {
      name: parametric.name,
      slug: parametric.slug
    });

    await updatePaymentStatus(request, confirmOrder.payment.id, "CONFIRMED");

    await expect
      .poll(async () => {
        const nextPayment = await getLatestPaymentForOrder(confirmOrder.order.uuid);
        return nextPayment?.status ?? null;
      })
      .toBe("CONFIRMED");

    const confirmedTimeline = await getLatestTimelineEventsForOrder(confirmOrder.order.uuid);
    expect(confirmedTimeline.some((event) => event.type === "PAYMENT_FULL")).toBeTruthy();

    await expect
      .poll(
        async () =>
          (await getNotificationsForOrder(confirmOrder.order.uuid)).filter(
            (row) => row.eventType === "PAYMENT_RECEIVED"
          ).length,
        {
          message: `waiting for payment notifications for ${confirmOrder.order.uuid}`
        }
      )
      .toBeGreaterThanOrEqual(1);

    const confirmedNotifications = await getNotificationsForOrder(confirmOrder.order.uuid);
    expect(confirmedNotifications.some((row) => row.eventType === "PAYMENT_RECEIVED")).toBeTruthy();

    await expect
      .poll(
        async () => (await getEmailLogsForOrder(confirmOrder.order.uuid)).filter((row) => row.category === "PAYMENTS").length,
        {
          message: `waiting for payment emails for ${confirmOrder.order.uuid}`
        }
      )
      .toBeGreaterThanOrEqual(1);
  });

  test("allows admin to fail registered cash payments without marking the order as fully paid", async ({
    page,
    request
  }) => {
    await bootstrapStorefrontContext(page);

    const simple = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const parametric = await fetchProductDetail(request, PARAMETRIC_PRODUCT_SLUG);

    const failCustomer = buildTestCustomer(Date.now() + 1);
    const failedOrder = await placeGuestCashOrder(page, failCustomer, simple.slug, {
      name: parametric.name,
      slug: parametric.slug
    });

    await updatePaymentStatus(request, failedOrder.payment.id, "FAILED");

    await expect
      .poll(async () => {
        const nextPayment = await getLatestPaymentForOrder(failedOrder.order.uuid);
        return nextPayment?.status ?? null;
      })
      .toBe("FAILED");

    const failedTimeline = await getLatestTimelineEventsForOrder(failedOrder.order.uuid);
    expect(failedTimeline.some((event) => event.type === "PAYMENT_FULL")).toBeFalsy();

    const failedNotifications = await getNotificationsForOrder(failedOrder.order.uuid);
    expect(failedNotifications.some((row) => row.eventType === "PAYMENT_RECEIVED")).toBeFalsy();

    const failedEmails = await getEmailLogsForOrder(failedOrder.order.uuid);
    expect(failedEmails.some((row) => row.category === "PAYMENTS")).toBeFalsy();
  });
});
