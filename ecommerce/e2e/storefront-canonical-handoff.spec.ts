import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { storefrontApiBaseUrl, storefrontBaseUrl } from "./support/env";

type SeoIndexable = {
  entityType: "product" | "canonical" | "category";
  path: string;
  slug: string;
};

const normalizeText = (value?: string | null) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function bootstrapStorefront(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("storefront.locale.v1", "es");
    window.localStorage.setItem("storefront.currency.preference", "UYU");
    if (!window.localStorage.getItem("storefront.cart.v1")) {
      window.localStorage.setItem("storefront.cart.v1", JSON.stringify({ items: [], updatedAt: Date.now() }));
    }
  });
}

async function listSeoIndexables(request: APIRequestContext): Promise<SeoIndexable[]> {
  const response = await request.get(`${storefrontApiBaseUrl}/seo/indexables`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as SeoIndexable[];
}

async function resolveSeoDocument(request: APIRequestContext, path: string) {
  const response = await request.get(`${storefrontApiBaseUrl}/seo/resolve?path=${encodeURIComponent(path)}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function readCartState(page: Page) {
  return page.evaluate((storageKey) => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : { items: [] };
    } catch {
      return { items: [] };
    }
  }, "storefront.cart.v1");
}

function pickCanonicalTarget(indexables: SeoIndexable[]) {
  const canonical = indexables.find((entry) => entry.entityType === "canonical" && /monoblock/i.test(entry.slug))
    ?? indexables.find((entry) => entry.entityType === "canonical" && /monoblock/i.test(entry.path))
    ?? indexables.find((entry) => entry.entityType === "canonical");

  if (!canonical) {
    throw new Error("Storefront did not return a canonical SEO target for the canonicity test.");
  }

  return canonical;
}

test.describe("storefront canonical handoff", () => {
  test.setTimeout(60_000);

  test("resolves the canonical monoblock route and preserves canonicalConfiguration through cart", async ({
    page,
    request,
  }) => {
    await test.step("bootstrap storefront state", async () => {
      await bootstrapStorefront(page);
    });

    const target = await test.step("select a canonical SEO target", async () => pickCanonicalTarget(await listSeoIndexables(request)));
    const seo = await test.step("resolve the canonical SEO document", async () => resolveSeoDocument(request, target.path));
    const baseOrigin = new URL(storefrontBaseUrl).origin;

    await test.step("render the canonical PDP metadata", async () => {
      await page.goto(target.path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(target.path)}$`));

      const title = normalizeText(await page.title());
      const description = normalizeText(
        await page.locator('meta[name="description"]').getAttribute("content"),
      );
      const canonical = normalizeText(await page.locator('link[rel="canonical"]').getAttribute("href"));

      expect(title).toBe(normalizeText(seo.title));
      expect(description).toBe(normalizeText(seo.description));
      expect(canonical).toBe(normalizeText(seo.canonicalUrl));
      expect(canonical.startsWith(baseOrigin)).toBeTruthy();

      await expect(page.getByTestId("product-detail-title")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("product-detail-add-to-cart")).toBeVisible({ timeout: 20_000 });
    });

    await test.step("add the canonical product to cart", async () => {
      await page.getByTestId("product-detail-add-to-cart").click();
      await expect(page.getByTestId("product-detail-decrease")).toBeVisible({ timeout: 20_000 });

      const cartState = await readCartState(page);
      expect(Array.isArray(cartState?.items) ? cartState.items.length : 0).toBeGreaterThan(0);
      const cartItem = Array.isArray(cartState?.items) ? cartState.items[0] : null;
      expect(cartItem?.product?.canonicalConfiguration).toBeTruthy();
    });

    await test.step("preserve canonicalConfiguration through cart persistence", async () => {
      await page.goto("/cart", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 2, name: /Carrito|Your Cart/i })).toBeVisible({
        timeout: 20_000,
      });

      const cartState = await readCartState(page);
      const cartItem = Array.isArray(cartState?.items) ? cartState.items[0] : null;

      expect(cartItem?.product?.canonicalConfiguration).toBeTruthy();
      expect(cartItem?.product?.canonicalConfiguration?.indexable).toBe(true);
      expect(normalizeText(cartItem?.product?.canonicalConfiguration?.slug)).toBeTruthy();
    });
  });
});
