import { StorefrontApi } from "@/lib/api/storefront";
import type {
  CmsPublicPageSummary,
  SeoIndexable,
  StorefrontConfig,
} from "@/types/storefront";
import type { MetadataRoute } from "next";
import { resolveAbsoluteUrl } from "./urls";

// Only structural storefront routes live here. Content-managed CMS paths are resolved dynamically
// from persistence and merged below, so adding/removing a CMS page automatically updates the sitemap.
const STRUCTURAL_ROUTES = ["/", "/categories", "/contacto", "/shop", "/tienda", "/presupuesto"] as const;

const buildMirrorPaths = (path: string): string[] => {
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
  const [indexables, cmsPages] = await Promise.all([
    StorefrontApi.listSeoIndexables().catch(() => [] as SeoIndexable[]),
    StorefrontApi.listCmsPages().catch(() => [] as CmsPublicPageSummary[]),
  ]);

  const staticEntries = STRUCTURAL_ROUTES.map((path) => ({
    url: resolveAbsoluteUrl(path, config),
    lastModified: undefined,
    priority: path === "/" ? 1 : 0.7,
  }));

  const reservedPaths = new Set<string>();
  for (const entry of indexables) {
    reservedPaths.add(entry.path);
    for (const mirrorPath of buildMirrorPaths(entry.path)) {
      reservedPaths.add(mirrorPath);
    }
  }

  const productEntries = indexables.map((entry) => ({
    url: resolveAbsoluteUrl(entry.path, config),
    lastModified: normalizeDate(entry.updatedAt),
    priority: entry.entityType === "canonical" ? 0.9 : entry.entityType === "category" ? 0.75 : 0.8,
  }));

  const cmsEntries = cmsPages
    .filter((page) => {
      const pagePath = page.path ? `/${page.path.replace(/^\/+/, "")}` : "/";
      return !reservedPaths.has(pagePath);
    })
    .map((page) => ({
      url: resolveAbsoluteUrl(page.path ? `/${page.path}` : "/", config),
      lastModified: normalizeDate(page.updatedAt),
      priority: page.path ? 0.6 : 1,
    }));

  let latestProductDate: Date | undefined;
  for (const entry of indexables) {
    latestProductDate = mergeLatest(latestProductDate, entry.updatedAt);
  }

  let latestCmsDate: Date | undefined;
  for (const page of cmsPages) {
    latestCmsDate = mergeLatest(latestCmsDate, page.updatedAt);
  }

  const homepageLastModified = [latestProductDate, latestCmsDate]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const entries = new Map<string, { url: string; lastModified?: Date; priority?: number }>();
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
  entries.set(homeUrl, { url: homeUrl, lastModified: homepageLastModified, priority: 1 });

  return Array.from(entries.values());
};
