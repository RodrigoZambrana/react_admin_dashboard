import { StorefrontApi } from "@/lib/api/storefront";
import type {
  CmsPublicPageSummary,
  ProductSummary,
  StorefrontConfig,
} from "@/types/storefront";
import type { MetadataRoute } from "next";
import { resolveAbsoluteUrl } from "./urls";

const PAGE_SIZE = 100;

// Only structural storefront routes live here. Content-managed CMS paths are resolved dynamically
// from persistence and merged below, so adding/removing a CMS page automatically updates the sitemap.
const STRUCTURAL_ROUTES = ["/", "/categories", "/shop", "/tienda", "/presupuesto"] as const;

const loadAllProducts = async (): Promise<ProductSummary[]> => {
  const firstPage = await StorefrontApi.listProducts({ page: 1, pageSize: PAGE_SIZE });
  const pages: typeof firstPage[] = [firstPage];

  if (firstPage.totalPages > 1) {
    const remaining = Array.from({ length: firstPage.totalPages - 1 }, (_, index) => index + 2);
    const settled = await Promise.allSettled(
      remaining.map((page) => StorefrontApi.listProducts({ page, pageSize: PAGE_SIZE })),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        pages.push(result.value);
      }
    }
  }

  return pages.flatMap((page) => page.data);
};

const normalizeDate = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const mergeLatest = (current: Date | undefined, candidate?: string | null): Date | undefined => {
  const next = normalizeDate(candidate);
  if (!next) return current;
  if (!current || next.getTime() > current.getTime()) return next;
  return current;
};

export const buildStorefrontSitemap = async (
  config: StorefrontConfig,
): Promise<MetadataRoute.Sitemap> => {
  const [products, cmsPages] = await Promise.all([
    loadAllProducts().catch(() => [] as ProductSummary[]),
    StorefrontApi.listCmsPages().catch(() => [] as CmsPublicPageSummary[]),
  ]);

  const staticEntries = STRUCTURAL_ROUTES.map((path) => ({
    url: resolveAbsoluteUrl(path, config),
    lastModified: undefined,
  }));

  const productEntries = products.map((product) => ({
    url: resolveAbsoluteUrl(`/product/${product.slug}`, config),
    lastModified: normalizeDate(product.updatedAt),
  }));

  const cmsEntries = cmsPages.map((page) => ({
    url: resolveAbsoluteUrl(page.path ? `/${page.path}` : "/", config),
    lastModified: normalizeDate(page.updatedAt),
  }));

  let latestProductDate: Date | undefined;
  for (const product of products) {
    latestProductDate = mergeLatest(latestProductDate, product.updatedAt);
  }

  let latestCmsDate: Date | undefined;
  for (const page of cmsPages) {
    latestCmsDate = mergeLatest(latestCmsDate, page.updatedAt);
  }

  const homepageLastModified = [latestProductDate, latestCmsDate]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const entries = new Map<string, { url: string; lastModified?: Date }>();
  for (const entry of staticEntries) {
    entries.set(entry.url, { url: entry.url, lastModified: entry.lastModified });
  }
  for (const entry of productEntries) {
    entries.set(entry.url, { url: entry.url, lastModified: entry.lastModified });
  }
  for (const entry of cmsEntries) {
    entries.set(entry.url, { url: entry.url, lastModified: entry.lastModified });
  }

  const homeUrl = resolveAbsoluteUrl("/", config);
  entries.set(homeUrl, { url: homeUrl, lastModified: homepageLastModified });

  return Array.from(entries.values());
};
