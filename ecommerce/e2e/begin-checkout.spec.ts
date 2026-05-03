import { expect, test, type Page } from "@playwright/test";

import {
  waitForLatestAnalyticsEventByEventId,
} from "./support/db";
import { fetchProductDetail } from "./support/storefront-api";

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

async function seedCartState(
  page: Page,
  product: {
    id: number;
    slug: string;
    name: string;
    price: { amount: number; currency: string };
    inventoryStatus: string;
    mode?: string | null;
  }
) {
  const cartState = {
    items: [
      {
        product: {
          id: String(product.id),
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
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

  await page.addInitScript(
    ({ cartState }) => {
      window.localStorage.setItem("storefront.cart.v1", JSON.stringify(cartState));
    },
    { cartState }
  );
}

test.describe("begin checkout browser validation", () => {
  test.setTimeout(90_000);

  test("records begin_checkout on the cart CTA and persists it in backend", async ({ page, request }) => {
    await bootstrapStorefrontContext(page);

    const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    await seedCartState(page, {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price ?? { amount: 0, currency: "USD" },
      inventoryStatus: product.inventoryStatus,
      mode: product.mode
    });

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    const checkoutLink = page.getByTestId("checkout-continue-to-payment");
    await expect(checkoutLink).toBeVisible();
    await expect(checkoutLink).toHaveAttribute("href", "/checkout");
    await checkoutLink.click({ force: true });

    await expect
      .poll(async () => {
        const captured = await getCapturedAnalyticsEvents(page);
        return captured.some(
          (event) => event?.event_name === "begin_checkout" && event?.cta_id === "checkout.continue_to_payment"
        );
      }, { timeout: 20_000 })
      .toBeTruthy();

    const capturedEvents = await getCapturedAnalyticsEvents(page);
    const beginCheckoutPayload = capturedEvents.find(
      (event) => event?.event_name === "begin_checkout" && event?.cta_id === "checkout.continue_to_payment"
    ) as Record<string, unknown> | undefined;

    expect(beginCheckoutPayload?.event_id).toBeTruthy();
    expect(beginCheckoutPayload?.tenant_id).toBe("urucortinas");
    expect(beginCheckoutPayload?.component_id).toBe("cart_checkout_summary");
    expect(beginCheckoutPayload?.page_type).toBeTruthy();

    const eventId = String(beginCheckoutPayload?.event_id);
    const rawEvent = await waitForLatestAnalyticsEventByEventId(eventId, 20_000);

    expect(rawEvent.eventName).toBe("begin_checkout");
    expect(rawEvent.tenantId).toBe("urucortinas");
    expect(rawEvent.ctaId).toBe("checkout.continue_to_payment");
    expect(rawEvent.componentId).toBe("cart_checkout_summary");
    expect(rawEvent.source).toBe("web");

  });
});
