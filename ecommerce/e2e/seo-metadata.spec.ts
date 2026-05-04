import { expect, test, type APIRequestContext } from "@playwright/test";

import { storefrontApiBaseUrl, storefrontBaseUrl } from "./support/env";

type SeoIndexable = {
  entityType: "product" | "canonical" | "category";
  path: string;
  slug: string;
};

const normalizeText = (value?: string | null) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const baseOrigin = new URL(storefrontBaseUrl).origin;

async function listSeoIndexables(request: APIRequestContext): Promise<SeoIndexable[]> {
  const response = await request.get(`${storefrontApiBaseUrl}/seo/indexables`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as SeoIndexable[];
}

async function resolveSeoDocument(request: APIRequestContext, path: string) {
  const response = await request.get(
    `${storefrontApiBaseUrl}/seo/resolve?path=${encodeURIComponent(path)}`,
  );
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function pickAuditPaths(indexables: SeoIndexable[]) {
  const products = indexables.filter((entry) => entry.entityType === "product").slice(0, 3);
  const canonicals = indexables.filter((entry) => entry.entityType === "canonical").slice(0, 3);
  const categories = indexables.filter((entry) => entry.entityType === "category").slice(0, 2);

  expect(products.length).toBeGreaterThanOrEqual(3);
  expect(canonicals.length).toBeGreaterThanOrEqual(3);
  expect(categories.length).toBeGreaterThanOrEqual(2);

  return [...products, ...canonicals, ...categories];
}

function buildMirrorPaths(path: string) {
  if (path.startsWith("/product/")) {
    const slug = path.replace("/product/", "");
    return [`/${slug}`, `/aberturas/${slug}`];
  }
  if (path.startsWith("/aberturas/")) {
    const slug = path.replace("/aberturas/", "");
    return [`/${slug}`, `/product/${slug}`];
  }
  if (/^\/[^/]+$/.test(path)) {
    const slug = path.slice(1);
    return [`/product/${slug}`, `/aberturas/${slug}`];
  }
  return [];
}

test("SEO routes render canonical metadata and visible SSR content without JavaScript", async ({
  browser,
  request,
}) => {
  const targets = pickAuditPaths(await listSeoIndexables(request));
  const context = await browser.newContext({ javaScriptEnabled: false });

  try {
    for (const target of targets) {
      const page = await context.newPage();
      const seo = await resolveSeoDocument(request, target.path);

      await page.goto(`${storefrontBaseUrl}${target.path}`, {
        waitUntil: "domcontentloaded",
      });

      const title = normalizeText(await page.title());
      const description = normalizeText(
        await page.locator('meta[name="description"]').getAttribute("content"),
      );
      const canonical = normalizeText(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
      );
      const bodyText = normalizeText(await page.locator("body").innerText());
      const jsonLdCount = await page.locator('script[type="application/ld+json"]').count();

      expect(title).toBe(normalizeText(seo.title));
      expect(description).toBe(normalizeText(seo.description));
      expect(canonical).toBe(normalizeText(seo.canonicalUrl));
      expect(canonical.startsWith(baseOrigin)).toBeTruthy();
      expect(bodyText.toLowerCase()).toContain(normalizeText(seo.title).toLowerCase());
      expect(jsonLdCount).toBeGreaterThan(0);

      await page.close();
    }
  } finally {
    await context.close();
  }
});

test("SEO mirror routes redirect to the canonical path", async ({ request }) => {
  const targets = pickAuditPaths(await listSeoIndexables(request));

  for (const target of targets) {
    for (const mirrorPath of buildMirrorPaths(target.path)) {
      const response = await request.get(`${storefrontBaseUrl}${mirrorPath}`, {
        failOnStatusCode: false,
        maxRedirects: 0,
      });

      expect([301, 307, 308]).toContain(response.status());
      const location = response.headers()["location"] ?? "";
      expect(location.endsWith(target.path)).toBeTruthy();
    }
  }
});
