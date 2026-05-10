import { expect, test, type Page } from "@playwright/test";

import { fetchFirstCatalogProduct } from "./support/storefront-api";

async function bootstrapStorefrontContext(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "UYU");
    window.localStorage.setItem("storefront.cart.v1", JSON.stringify({ items: [], updatedAt: Date.now() }));
  });
}

test.describe("storefront search", () => {
  test.setTimeout(60_000);

  test("shows search results and opens the matching product from the catalog listing", async ({
    page,
    request,
  }) => {
    await bootstrapStorefrontContext(page);

    const product = await fetchFirstCatalogProduct(request);
    const searchTerm = product.name;

    await page.goto(`/shop?query=${encodeURIComponent(searchTerm)}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText(`Buscando “${searchTerm}”`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/resultados encontrados$/i)).toBeVisible({ timeout: 20_000 });
    const firstResultTitle = page.getByTestId(`product-card-title-${product.slug}`);
    await expect(firstResultTitle).toBeVisible({ timeout: 20_000 });

    await firstResultTitle.click();
    await expect(page).toHaveURL(/\/product\/[^/?]+$/);
    await expect(page.getByTestId("product-detail-title")).toBeVisible({ timeout: 20_000 });
  });

  test("shows the empty state when the query has no matches", async ({ page }) => {
    await bootstrapStorefrontContext(page);

    const noMatchQuery = "zzzz-no-match-2026";

    await page.goto(`/shop?query=${encodeURIComponent(noMatchQuery)}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText(`Buscando “${noMatchQuery}”`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`No encontramos productos para “${noMatchQuery}”.`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Mostrando 0 productos")).toBeVisible({ timeout: 20_000 });
  });
});
