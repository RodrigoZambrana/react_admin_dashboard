import { expect, test } from "@playwright/test";

import { storefrontApiBaseUrl, storefrontBaseUrl } from "./support/env";

async function getFirstProductSlug(request: any) {
  const response = await request.get(`${storefrontApiBaseUrl}/products?page=1&pageSize=1`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const firstProduct = Array.isArray(payload.data) ? payload.data[0] : null;
  expect(firstProduct?.slug).toBeTruthy();
  return String(firstProduct.slug);
}

async function readMetadata(page: any) {
  return {
    title: await page.title(),
    description: await page.locator('meta[name="description"]').getAttribute("content"),
    canonical: await page.locator('link[rel="canonical"]').getAttribute("href"),
    ogType: await page.locator('meta[property="og:type"]').getAttribute("content"),
  };
}

test("storefront routes expose structural SEO metadata out of the box", async ({
  page,
  request,
}) => {
  const productSlug = await getFirstProductSlug(request);

  await page.goto(`${storefrontBaseUrl}/`, { waitUntil: "domcontentloaded" });
  const homeMeta = await readMetadata(page);
  expect(homeMeta.title?.toLowerCase()).toContain("urucortinas");
  expect(homeMeta.description).toBeTruthy();
  expect(homeMeta.canonical).toBeTruthy();

  await page.goto(`${storefrontBaseUrl}/shop`, { waitUntil: "domcontentloaded" });
  const shopMeta = await readMetadata(page);
  expect(shopMeta.title).toContain("Catálogo");
  expect(shopMeta.description).toContain("catálogo público");
  expect(shopMeta.canonical).toContain("/shop");

  await page.goto(`${storefrontBaseUrl}/product/${productSlug}`, {
    waitUntil: "domcontentloaded",
  });
  const productMeta = await readMetadata(page);
  expect(productMeta.title?.length).toBeGreaterThan(0);
  expect(productMeta.description?.length).toBeGreaterThan(0);
  expect(productMeta.canonical).toContain(`/product/${productSlug}`);

  await page.goto(`${storefrontBaseUrl}/quienes-somos`, {
    waitUntil: "domcontentloaded",
  });
  const cmsMeta = await readMetadata(page);
  expect(cmsMeta.title).toContain("Quiénes somos");
  expect(cmsMeta.description?.length).toBeGreaterThan(0);
  expect(cmsMeta.ogType).toBe("article");
  expect(cmsMeta.canonical).toContain("/quienes-somos");
});
