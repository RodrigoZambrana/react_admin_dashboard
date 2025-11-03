import { StorefrontApi, resetSnapshotCaches } from "@/lib/api/storefront";
import { writeJsonCache } from "@/lib/persistent-cache";
import type { ProductListQuery, ProductSummary } from "@/types/storefront";
import type { StorefrontSnapshot } from "./types";
import { clearSnapshotCache } from "./loaders";

const DEFAULT_CATEGORY_SNAPSHOT_LIMIT = 12;
const DEFAULT_CATEGORY_PAGE_SIZE = 16;
const DEFAULT_FEATURED_PAGE_SIZE = 32;

type SnapshotProductRequest = {
  label: "featured" | "newest" | "bestSellers";
  query: ProductListQuery;
  pageSize: number;
};

const PRODUCT_SNAPSHOT_REQUESTS: SnapshotProductRequest[] = [
  { label: "featured", query: { sort: "featured" }, pageSize: DEFAULT_FEATURED_PAGE_SIZE },
  { label: "newest", query: { sort: "newest" }, pageSize: DEFAULT_FEATURED_PAGE_SIZE },
  { label: "bestSellers", query: { sort: "best-sellers" }, pageSize: DEFAULT_FEATURED_PAGE_SIZE },
];

const uniqueBySlug = (items: ProductSummary[]): ProductSummary[] => {
  const map = new Map<string | number, ProductSummary>();
  for (const item of items) {
    const key = item.slug ?? item.id;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
};

export interface CaptureSnapshotOptions {
  categoryLimit?: number;
  categoryPageSize?: number;
  productPageSize?: number;
}

export async function captureStorefrontSnapshot(
  options: CaptureSnapshotOptions = {},
): Promise<StorefrontSnapshot> {
  const capturedAt = new Date().toISOString();
  const categoryLimit = options.categoryLimit ?? DEFAULT_CATEGORY_SNAPSHOT_LIMIT;
  const categoryPageSize = options.categoryPageSize ?? DEFAULT_CATEGORY_PAGE_SIZE;
  const productPageSize = options.productPageSize ?? DEFAULT_FEATURED_PAGE_SIZE;

  const [config, categories] = await Promise.all([
    StorefrontApi.getConfig(),
    StorefrontApi.listCategories(),
  ]);

  const products: StorefrontSnapshot["products"] = {
    featured: [],
    newest: [],
    bestSellers: [],
    byCategory: {},
  };

  // Capture generic product collections (newest, featured, best sellers)
  for (const request of PRODUCT_SNAPSHOT_REQUESTS) {
    const { data } = await StorefrontApi.listProducts({
      ...request.query,
      pageSize: request.pageSize ?? productPageSize,
    });

    const unique = uniqueBySlug(data);
    if (request.label === "featured") products.featured = unique;
    if (request.label === "newest") products.newest = unique;
    if (request.label === "bestSellers") products.bestSellers = unique;
  }

  // Build per-category snapshots (limited)
  const categoryCandidates = categories.slice(0, categoryLimit);
  for (const category of categoryCandidates) {
    try {
      const { data } = await StorefrontApi.listProducts({
        categorySlug: category.slug,
        sort: "featured",
        pageSize: categoryPageSize,
      });

      products.byCategory[category.slug] = uniqueBySlug(data);
    } catch (error) {
      console.warn(
        `[snapshot] Unable to capture products for category "${category.slug}", skipping.`,
        error,
      );
    }
  }

  const snapshot: StorefrontSnapshot = {
    version: 1,
    capturedAt,
    config,
    categories,
    products,
  };

  await writeJsonCache("storefront-snapshot", snapshot);
  // align config cache used elsewhere
  await writeJsonCache("storefront-config", snapshot.config);
  clearSnapshotCache();
  resetSnapshotCaches();

  return snapshot;
}
