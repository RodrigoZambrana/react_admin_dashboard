import { expect, test, type Page } from "@playwright/test";

import { fetchProductDetail } from "./support/storefront-api";

const SIMPLE_PRODUCT_SLUG = "cortinas-roller";
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: MOBILE_USER_AGENT,
  isMobile: true,
  hasTouch: true,
});

async function bootstrapStorefrontContext(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "UYU");
    window.localStorage.setItem("storefront.cart.v1", JSON.stringify({ items: [], updatedAt: Date.now() }));
  });
}

async function readCartItems(page: Page) {
  return page.evaluate((storageKey) => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as { items?: Array<unknown> }) : { items: [] };
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }, "storefront.cart.v1");
}

async function waitForCartItemCount(page: Page, expectedCount: number) {
  await expect
    .poll(async () => (await readCartItems(page)).length, { timeout: 20_000 })
    .toBe(expectedCount);
}

async function seedCartState(
  page: Page,
  product: {
    id: number;
    slug: string;
    name: string;
    price: { amount: number; currency: string } | null;
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
          price: product.price ?? { amount: 0, currency: "UYU" },
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
    ({ storageKey, cartState: nextCartState }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(nextCartState));
    },
    { storageKey: "storefront.cart.v1", cartState }
  );
}

function cartLineLocator(page: Page) {
  return page.locator(
    '[data-testid^="cart-line-"]:not([data-testid*="-increase-"]):not([data-testid*="-decrease-"]):not([data-testid*="-quantity-"]):not([data-testid*="-remove-"])'
  );
}

test.describe("mobile storefront core", () => {
  test.setTimeout(90_000);

  test("keeps the storefront usable on a mobile viewport from catalog search to checkout", async ({
    page,
    request,
  }) => {
    await bootstrapStorefrontContext(page);

    const product = await fetchProductDetail(request, SIMPLE_PRODUCT_SLUG);
    await seedCartState(page, {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price ?? { amount: 0, currency: "UYU" },
      inventoryStatus: product.inventoryStatus,
      mode: product.mode
    });

    await page.goto("/shop", { waitUntil: "domcontentloaded" });

    await expect(page.locator("button.link-button").filter({ hasText: "Menú" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("button.link-button").filter({ hasText: "Categorías" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("button.link-button").filter({ hasText: "Carrito" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("button.link-button").filter({ hasText: "Cuenta" })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/product/${product.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/product/${product.slug}$`));
    await expect(page.getByTestId("product-detail-title")).toHaveText(product.name, { timeout: 20_000 });

    await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible({ timeout: 20_000 });

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await waitForCartItemCount(page, 1);
    await expect(cartLineLocator(page)).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByTestId("checkout-continue-to-payment")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("checkout-continue-to-payment").click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 20_000 });
    await expect(page.locator('input[name="firstName"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[name="street"]')).toBeVisible({ timeout: 20_000 });
  });
});
