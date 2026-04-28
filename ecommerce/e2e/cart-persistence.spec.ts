import { expect, test } from "@playwright/test";

import { fetchProductDetail } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";

test("persists the storefront cart after reload", async ({ page, request }) => {
  const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);

  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "USD");
  });

  await page.goto(`/product/${product.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("product-detail-add-to-cart").click();

  await expect
    .poll(
      async () =>
        page.evaluate((storageKey) => {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) return 0;
          const parsed = JSON.parse(raw) as { items?: Array<unknown> };
          return parsed.items?.length ?? 0;
        }, "storefront.cart.v1"),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  const cartLine = page.locator('[data-testid^="cart-line-"]').first();
  await expect(cartLine).toBeVisible({ timeout: 20_000 });

  const cartLineTestId = await cartLine.getAttribute("data-testid");
  const lineId = cartLineTestId?.replace("cart-line-", "") ?? "";
  expect(lineId).toBeTruthy();

  await page.getByTestId(`cart-line-increase-${lineId}`).click();
  await expect
    .poll(
      async () =>
        page.evaluate((storageKey) => {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw) as { items?: Array<{ quantity?: number }> };
          return parsed.items?.[0]?.quantity ?? null;
        }, "storefront.cart.v1"),
      { timeout: 20_000 }
    )
    .toBe(2);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(`[data-testid="cart-line-${lineId}"]`)).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(
      async () =>
        page.evaluate((storageKey) => {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw) as { items?: Array<{ quantity?: number }> };
          return parsed.items?.[0]?.quantity ?? null;
        }, "storefront.cart.v1"),
      { timeout: 20_000 }
    )
    .toBe(2);
});
