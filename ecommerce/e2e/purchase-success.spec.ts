import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { waitForLatestAnalyticsEventByEventId } from "./support/db";
import { buildTestCustomer } from "./support/factories";
import { fetchProductDetail, listShippingOptions } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

async function bootstrapStorefrontContext(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "USD");

    const analyticsStoreKey = "__e2e_structural_analytics_events_v1__";
    const readStoredEvents = () => {
      try {
        const raw = window.sessionStorage.getItem(analyticsStoreKey);
        return raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      } catch {
        return [];
      }
    };
    const persistEvent = (entry: unknown) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const payload = entry as Record<string, unknown>;
      if (!payload.event_name && !payload.event) {
        return;
      }

      const current = readStoredEvents();
      current.push(payload);
      window.sessionStorage.setItem(analyticsStoreKey, JSON.stringify(current));
    };

    const persistBeaconEvent = (body: BodyInit | null | undefined) => {
      if (!body) {
        return;
      }
      if (typeof body === "string") {
        try {
          persistEvent(JSON.parse(body));
        } catch {
          // noop
        }
        return;
      }
      if (body instanceof Blob) {
        void body.text().then((text) => {
          try {
            persistEvent(JSON.parse(text));
          } catch {
            // noop
          }
        });
      }
    };

    const globalWindow = window as Window & { dataLayer?: Array<Record<string, unknown>> };
    const dataLayer = globalWindow.dataLayer ?? [];
    globalWindow.dataLayer = dataLayer;
    const originalPush = dataLayer.push.bind(dataLayer);
    dataLayer.push = (...entries: Record<string, unknown>[]) => {
      for (const entry of entries) {
        persistEvent(entry);
      }
      return originalPush(...entries);
    };

    const originalSendBeacon = globalWindow.navigator.sendBeacon.bind(globalWindow.navigator);
    Object.defineProperty(globalWindow.navigator, "sendBeacon", {
      configurable: true,
      value: (url: string | URL, data?: BodyInit | null) => {
        if (typeof url === "string" && url.includes("/api/analytics/events")) {
          persistBeaconEvent(data);
        }
        return originalSendBeacon(url, data);
      }
    });
  });
}

async function getCapturedAnalyticsEvents(page: Page) {
  return page.evaluate(() => {
    const analyticsStoreKey = "__e2e_structural_analytics_events_v1__";
    try {
      const raw = window.sessionStorage.getItem(analyticsStoreKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      return parsed.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
    } catch {
      return [];
    }
  });
}

test.describe("purchase browser validation", () => {
  test.setTimeout(90_000);

  test("records purchase on the success page and persists it in backend", async ({ page, request }) => {
    await bootstrapStorefrontContext(page);

    const customer = buildTestCustomer(Date.now() + 1_000);
    const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    const shippingOptions = await listShippingOptions(request);
    expect(shippingOptions.length).toBeGreaterThan(0);
    const shippingOption = shippingOptions[0]!;
    const orderUuid = randomUUID();

    const cartState = {
      items: [
        {
          product: {
            id: String(product.id),
            productId: product.id,
            slug: product.slug,
            name: product.name,
            price: product.price ?? { amount: 0, currency: "USD" },
            salePrice: null,
            inventoryStatus: product.inventoryStatus,
            mode: product.mode ?? "simple",
            canonicalConfiguration: null
          },
          quantity: 1
        }
      ],
      updatedAt: Date.now()
    };

    const cartItem = {
      product: {
        id: String(product.id),
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price ?? { amount: 0, currency: "USD" },
        salePrice: null,
        inventoryStatus: product.inventoryStatus,
        mode: product.mode ?? "simple",
        canonicalConfiguration: null
      },
      quantity: 1
    };

    const lineItem = {
      productId: product.id,
      quantity: 1,
      price: product.price ?? { amount: 0, currency: "USD" },
      total: product.price ?? { amount: 0, currency: "USD" },
      name: product.name,
      image: null,
      specifications: []
    };

    const checkoutState = {
      contact: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone
      },
      shippingAddress: {
        line1: "Av. Italia 1234",
        line2: "",
        street: "Av. Italia",
        number: "1234",
        corner: "Comercio",
        apartment: "101",
        comments: "",
        city: "Montevideo",
        department: "Montevideo",
        neighborhood: "Aguada",
        state: "Montevideo",
        zip: "11000",
        country: "UY"
      },
      fulfillmentMode: "home_delivery",
      shippingOption,
      payment: { method: "cod" },
      notes: "",
      completed: { details: true, payment: true },
      lastOrder: {
        id: Date.now(),
        uuid: orderUuid,
        orderNumber: `${Date.now()}`,
        reference: `ORD-${Date.now()}`,
        placedAt: new Date().toISOString(),
        status: "confirmed",
        statusLabel: "Confirmed",
        paymentStatus: "pending",
        paymentStatusLabel: "Pending",
        fulfillmentStatus: "confirmed",
        fulfillmentStatusLabel: "Confirmed",
        items: [lineItem],
        summary: {
          items: [lineItem],
          subtotal: product.price ?? { amount: 0, currency: "USD" },
          tax: { amount: 0, currency: "USD" },
          shipping: { amount: shippingOption.deliveryFees, currency: "USD" },
          discounts: [],
          grandTotal: {
            amount: (product.price?.amount ?? 0) + shippingOption.deliveryFees,
            currency: product.price?.currency ?? "USD"
          },
          estimatedDelivery: "1 day",
          notes: "",
          delivery: {
            mode: "home_delivery",
            modeLabel: "Home delivery",
            shippingVendor: shippingOption.name,
            estimatedMin: shippingOption.estimatedMin,
            estimatedMax: shippingOption.estimatedMax,
            estimatedLabel: "1 day"
          }
        },
        delivery: {
          mode: "home_delivery",
          modeLabel: "Home delivery",
          shippingVendor: shippingOption.name,
          estimatedMin: shippingOption.estimatedMin,
          estimatedMax: shippingOption.estimatedMax,
          estimatedLabel: "1 day"
        },
        shippingAddress: {
          line1: "Av. Italia 1234",
          line2: "",
          street: "Av. Italia",
          number: "1234",
          corner: "Comercio",
          apartment: "101",
          comments: "",
          city: "Montevideo",
          department: "Montevideo",
          neighborhood: "Aguada",
          state: "Montevideo",
          zip: "11000",
          country: "UY"
        }
      } as Record<string, unknown>,
      checkoutToken: orderUuid
    };

    await page.addInitScript(
      ({ cartStateState, checkoutStateState }) => {
        window.localStorage.setItem("storefront.cart.v1", JSON.stringify(cartStateState));
        window.sessionStorage.setItem("storefront:checkout:state", JSON.stringify(checkoutStateState));
        (window as Window & { __e2ePurchaseOrder__?: unknown }).__e2ePurchaseOrder__ =
          (checkoutStateState as { lastOrder?: unknown }).lastOrder ?? null;
      },
      { cartStateState: { items: [cartItem], updatedAt: Date.now() }, checkoutStateState: checkoutState }
    );

    await page.goto(`/payment/success?method=cod&orderUuid=${encodeURIComponent(orderUuid)}`, {
      waitUntil: "domcontentloaded"
    });
    const injectedPurchaseOrder = await page.evaluate(
      () => (window as Window & { __e2ePurchaseOrder__?: { uuid?: string } | null }).__e2ePurchaseOrder__ ?? null
    );
    expect(injectedPurchaseOrder?.uuid).toBe(orderUuid);
    const persistedCheckoutRaw = await page.evaluate(() => window.sessionStorage.getItem("storefront:checkout:state"));
    expect(persistedCheckoutRaw).toBeTruthy();
    const persistedCheckout = persistedCheckoutRaw
      ? (JSON.parse(persistedCheckoutRaw) as { lastOrder?: { uuid?: string } | null })
      : null;
    expect(persistedCheckout?.lastOrder?.uuid).toBe(orderUuid);
    await expect(page.locator("body")).toContainText(/pedido recibido/i, { timeout: 20_000 });

    await expect
      .poll(async () => {
        const captured = await getCapturedAnalyticsEvents(page);
        return captured.some(
          (event) => event?.event_name === "purchase" && event?.cta_id === "checkout.purchase.confirm"
        );
      }, { timeout: 20_000 })
      .toBeTruthy();

    const capturedEvents = await getCapturedAnalyticsEvents(page);
    const purchasePayload = capturedEvents.find(
      (event) => event?.event_name === "purchase" && event?.cta_id === "checkout.purchase.confirm"
    ) as Record<string, unknown> | undefined;

    expect(purchasePayload?.event_id).toBeTruthy();
    expect(purchasePayload?.tenant_id).toBe("urucortinas");
    expect(purchasePayload?.component_id).toBe("checkout_purchase");
    expect(purchasePayload?.page_type).toBeTruthy();

    const eventId = String(purchasePayload?.event_id);
    const rawEvent = await waitForLatestAnalyticsEventByEventId(eventId, 20_000);

    expect(rawEvent.eventName).toBe("purchase");
    expect(rawEvent.tenantId).toBe("urucortinas");
    expect(rawEvent.ctaId).toBe("checkout.purchase.confirm");
    expect(rawEvent.componentId).toBe("checkout_purchase");
    expect(rawEvent.source).toBe("web");

  });
});
