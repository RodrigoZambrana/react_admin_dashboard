import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { fetchFirstInStockCatalogProduct } from "./support/storefront-api";

const normalizeText = (value?: string | null) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

async function bootstrapStorefront(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "UYU");
  });
}

test.describe("storefront visual stability", () => {
  test.setTimeout(60_000);

  test("renders home, shop listing and PDP without blank or broken initial states", async ({
    page,
    request,
  }) => {
    await test.step("bootstrap storefront state", async () => {
      await bootstrapStorefront(page);
    });

    const product = await test.step("select a real in-stock catalog product", async () => {
      return fetchFirstInStockCatalogProduct(request as APIRequestContext);
    });

    await test.step("render home without a blank initial state", async () => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
      expect(normalizeText(await page.locator("body").innerText()).length).toBeGreaterThan(0);
    });

    await test.step("render shop listing with a visible product card", async () => {
      await page.goto("/shop", { waitUntil: "domcontentloaded" });
      expect(normalizeText(await page.locator("body").innerText()).length).toBeGreaterThan(0);
      await expect(page.getByTestId(`product-card-${product.slug}`)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId(`product-card-title-${product.slug}`)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId(`product-card-price-${product.slug}`)).toBeVisible({ timeout: 20_000 });
    });

    await test.step("render PDP without a blank initial state", async () => {
      const productPath = product.routePath ?? `/product/${product.slug}`;
      await page.goto(productPath, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`${productPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      await expect(page.getByTestId("product-detail-title")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible({ timeout: 20_000 });
      expect(normalizeText(await page.locator("body").innerText()).length).toBeGreaterThan(0);
    });

    await test.step("keep a visible main CTA when present", async () => {
      const heroCta = page
        .getByRole("link", { name: /Ver productos|Shop now|View products|Browse products|Explorar soluciones|Explore solutions/i })
        .first();
      if ((await heroCta.count()) > 0) {
        await expect(heroCta).toBeVisible({ timeout: 20_000 });
      }
    });
  });
});
