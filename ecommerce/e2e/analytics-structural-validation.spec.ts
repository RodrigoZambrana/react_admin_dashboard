import { expect, test, type Page } from "@playwright/test";

import { waitForLatestAnalyticsEventByEventId, waitForLatestAnalyticsEventByEventName } from "./support/db";

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

async function getDataLayerAnalyticsEvents(page: Page) {
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

async function waitForCartItemCount(page: Page, expectedCount: number) {
  await expect
    .poll(async () => {
      return page.evaluate((storageKey) => {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : { items: [] };
        return Array.isArray(parsed?.items) ? parsed.items.length : 0;
      }, "storefront.cart.v1");
    })
    .toBe(expectedCount);
}

test.describe("structural analytics real-usage validation", () => {
  test.setTimeout(90_000);

  test("records component_view, select_item and add_to_cart with raw persistence", async ({
    page,
    request,
  }) => {
    await bootstrapStorefrontContext(page);

    await page.goto("/shop", { waitUntil: "domcontentloaded" });

    await expect
      .poll(
        async () =>
          (await getDataLayerAnalyticsEvents(page)).some(
            (event) => event?.event_name === "component_view" && event?.component_id === "storefront_header"
          ),
        { timeout: 15_000 }
      )
      .toBeTruthy();

    const headerView = (await getDataLayerAnalyticsEvents(page)).find(
      (event) => event?.event_name === "component_view" && event?.component_id === "storefront_header"
    );
    expect(headerView?.component_id).toBe("storefront_header");
    expect(headerView?.event_id).toBeTruthy();
    expect(headerView?.tenant_id).toBe("urucortinas");

    const productLink = page.locator('a[href^="/product/"]').first();
    await expect(productLink).toBeVisible();
    await expect(productLink).toHaveAttribute("href", /\/product\/[^/?]+/);
    await productLink.click({ force: true });
    await page.waitForURL(/\/product\/[^/?]+/);

    await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible();

    await page.getByTestId("product-detail-add-to-cart").click();
    await waitForCartItemCount(page, 1);
    const addToCartEvent = await waitForLatestAnalyticsEventByEventName("add_to_cart", 20_000, {
      tenantId: "urucortinas",
      ctaId: "product.detail.add_to_cart.primary",
      componentId: "product_intro_primary_cta"
    });

    const productIncreaseButton = page.getByTestId("product-detail-increase");
    await expect(productIncreaseButton).toBeVisible();
    await productIncreaseButton.click();

    const selectItemEvent = await waitForLatestAnalyticsEventByEventName("select_item", 20_000, {
      tenantId: "urucortinas"
    });

    expect(addToCartEvent.eventId).toBeTruthy();
    expect(selectItemEvent.eventId).toBeTruthy();
    expect(addToCartEvent.ctaId).toBe("product.detail.add_to_cart.primary");
    expect(addToCartEvent.componentId).toBe("product_intro_primary_cta");
    expect(selectItemEvent.ctaId).toBeTruthy();

    const rawAddToCart = await waitForLatestAnalyticsEventByEventId(String(addToCartEvent.eventId));
    const rawSelect = await waitForLatestAnalyticsEventByEventId(String(selectItemEvent.eventId));

    expect(rawAddToCart.eventName).toBe("add_to_cart");
    expect(rawAddToCart.tenantId).toBe("urucortinas");
    expect(rawAddToCart.ctaId).toBe("product.detail.add_to_cart.primary");
    expect(rawAddToCart.componentId).toBe("product_intro_primary_cta");
    expect(rawAddToCart.source).toBe("web");

    expect(rawSelect.eventName).toBe("select_item");
  });
});
