import { expect, test, type Page } from "@playwright/test";

import { storefrontBaseUrl } from "./support/env";

type PersistedCartState = {
  items: Array<{
    product: Record<string, unknown>;
    quantity: number | string;
  }>;
  updatedAt: number;
};

const baseProduct = {
  id: "cart-line-1",
  productId: 1,
  slug: "roller-blackout",
  name: "Roller Blackout",
  price: { amount: 100, currency: "UYU", formatted: "$100" },
  inventoryStatus: { label: "Disponible", tone: "success" },
};

async function seedCartState(page: Page, state: PersistedCartState) {
  await page.addInitScript((cartState) => {
    window.localStorage.setItem("storefront.cart.v1", JSON.stringify(cartState));
  }, state);
}

test("cart normalizes zero quantity from persisted state", async ({ page }) => {
  await seedCartState(page, {
    items: [{ product: baseProduct, quantity: 0 }],
    updatedAt: Date.now(),
  });

  await page.goto(`${storefrontBaseUrl}/cart`, { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("cart-line-cart-line-1")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("cart-line-decrease-cart-line-1")).toBeDisabled();
});

test("cart normalizes text quantity from persisted state", async ({ page }) => {
  await seedCartState(page, {
    items: [{ product: baseProduct, quantity: "abc" }],
    updatedAt: Date.now(),
  });

  await page.goto(`${storefrontBaseUrl}/cart`, { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("cart-line-cart-line-1")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("cart-line-decrease-cart-line-1")).toBeDisabled();
});
