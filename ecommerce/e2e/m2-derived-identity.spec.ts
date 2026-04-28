import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { storefrontApiBaseUrl } from "./support/env";

type DerivedProductSummary = {
  id: string;
  baseProductId: number;
  sizeId: number;
  name: string;
  slug: string;
  totalPrice: number;
  currency: string;
  sizeLabel: string;
  stock: number;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function bootstrapStorefront(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "UYU");
    window.localStorage.setItem("storefront.cart.v1", JSON.stringify({ items: [], updatedAt: Date.now() }));
  });
}

async function fetchFirstDerivedProduct(request: APIRequestContext): Promise<DerivedProductSummary> {
  const response = await request.get(`${storefrontApiBaseUrl}/m2-derived`);
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as DerivedProductSummary[];
  const derived = payload.find((entry) => Number.isFinite(entry?.stock) && entry.stock > 0) ?? payload[0];

  if (!derived?.slug || !derived?.name) {
    throw new Error("Storefront did not return any derived m2 product for integration testing.");
  }

  return derived;
}

test.describe("derived m2 storefront integration", () => {
  test.setTimeout(60_000);

  test("renders the same derived identity in /shop and /product/:slug", async ({ page, request }) => {
    await bootstrapStorefront(page);

    const derived = await fetchFirstDerivedProduct(request);

    await page.goto(`/shop?search=${encodeURIComponent(derived.slug)}`, { waitUntil: "domcontentloaded" });

    const card = page.getByTestId(`product-card-${derived.slug}`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByTestId(`product-card-title-${derived.slug}`)).toHaveText(derived.name);

    const cardPrice = (await card.getByTestId(`product-card-price-${derived.slug}`).textContent())?.trim();
    expect(cardPrice).toBeTruthy();

    await card.getByTestId(`product-card-title-${derived.slug}`).click();
    await expect(page).toHaveURL(new RegExp(`/product/${escapeRegExp(derived.slug)}$`));

    await expect(page.getByTestId("product-detail-title")).toHaveText(derived.name, { timeout: 20_000 });
    const detailPrice = (await page.getByTestId("product-detail-price").textContent())?.trim();

    expect(detailPrice).toBe(cardPrice);
  });

  test("switches a derived detail page to quantity mode after add to cart", async ({ page, request }) => {
    await bootstrapStorefront(page);

    const derived = await fetchFirstDerivedProduct(request);

    await page.goto(`/shop?search=${encodeURIComponent(derived.slug)}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(`product-card-${derived.slug}`)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(`product-card-title-${derived.slug}`).click();

    await expect(page).toHaveURL(new RegExp(`/product/${escapeRegExp(derived.slug)}$`));
    await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("product-detail-add-to-cart").click();
    await expect(page.getByTestId("product-detail-decrease")).toBeVisible({ timeout: 20_000 });
  });
});
