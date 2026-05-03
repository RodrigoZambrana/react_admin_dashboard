import type {
  AuthSession,
  CategorySummary,
  CheckoutSummary,
  CheckoutSnapshotPayload,
  CreateOrderPayload,
  CustomerNotificationList,
  CustomerProfile,
  CustomerWishlist,
  HomeLayoutDefinition,
  OrderSummary,
  PublicOrderSummary,
  ParametricConfigSnapshot,
  ParametricQuoteRequest,
  ParametricQuoteResult,
  PaginatedResponse,
  ProductDetail,
  ProductListQuery,
  CmsContentSection,
  CmsRenderablePage,
  CmsPublicPageSummary,
  ProductSummary,
  StorefrontShippingOption,
  StorefrontConfig,
  BudgetAddToCartRequest,
  BudgetAddToCartResponse,
  BudgetCalculationResult,
  BudgetProductSummary,
  BudgetLeadRequest,
  BudgetLeadResponse,
  BudgetSummaryRequest,
  BudgetSummaryResponse,
  StorefrontProductMediaResponse,
} from "@/types/storefront";
import type { StoryDetail, StorySummary } from "@/types/stories";
import type { OrderTimelineResponse } from "@/types/orderTimeline";

import { env } from "@/lib/env";
import { apiFetch, isApiError } from "../http";
import { loadStorefrontSnapshot } from "@/lib/snapshots/loaders";
import { isSnapshotFallbackEnabled } from "@/lib/resilience-flags";
import type { StorefrontSnapshot } from "@/lib/snapshots/types";
import { normalizeSearchValue } from "@/lib/storefront/search-utils";
import { resolveMediaAssetUrl } from "@/lib/media";

let cachedFallbackCategories: CategorySummary[] | null = null;

export const resetSnapshotCaches = () => {
  cachedFallbackCategories = null;
};

const loadFallbackCategoriesFromSnapshot = async (): Promise<CategorySummary[]> => {
  if (cachedFallbackCategories) {
    return cachedFallbackCategories;
  }
  const record = await loadStorefrontSnapshot();
  if (!record) {
    return [];
  }
  cachedFallbackCategories = record.value.categories ?? [];
  return cachedFallbackCategories;
};

const selectSnapshotProducts = (
  snapshot: StorefrontSnapshot,
  query: ProductListQuery,
): ProductSummary[] => {
  if (query.categorySlug) {
    const byCategory = snapshot.products.byCategory[query.categorySlug];
    if (byCategory && byCategory.length) {
      return byCategory;
    }
  }

  switch (query.sort) {
    case "newest":
      return snapshot.products.newest;
    case "best-sellers":
      return snapshot.products.bestSellers;
    case "featured":
    default:
      return snapshot.products.featured;
  }
};

const buildPaginatedResponse = (
  items: ProductSummary[],
  query: ProductListQuery,
): PaginatedResponse<ProductSummary> => {
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 12;
  const page = query.page && query.page > 0 ? query.page : 1;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    data: items.slice(start, end),
    total,
    page,
    pageSize,
    totalPages,
  };
};

const loadAllStorefrontProducts = async (search?: string): Promise<ProductSummary[]> => {
  const trimmedSearch = search?.trim() ?? "";
  const firstPage = await apiFetch<PaginatedResponse<ProductSummary>>("products", {
    params: {
      page: 1,
      pageSize: 48,
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
    },
    ...buildPublicCacheOptions(["products"]),
  });

  const responses: typeof firstPage[] = [firstPage];

  if (firstPage.totalPages > 1) {
    const remainingPages = Array.from({ length: firstPage.totalPages - 1 }, (_, index) => index + 2);
    const settled = await Promise.allSettled(
      remainingPages.map((page) =>
        apiFetch<PaginatedResponse<ProductSummary>>("products", {
          params: {
            page,
            pageSize: 48,
            ...(trimmedSearch ? { search: trimmedSearch } : {}),
          },
          ...buildPublicCacheOptions(["products"]),
        }),
      ),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        responses.push(result.value);
      } else if (!isApiError(result.reason)) {
        console.warn("[storefront] Failed to fetch additional product pages", result.reason);
      }
    }
  }

  return responses.flatMap((response) => response.data);
};

const budgetApiOrigin = new URL(env.apiBaseUrl).origin;
const budgetApiBaseUrl = `${budgetApiOrigin}/api/budget/`;
const budgetApiUrl = (path: string) => new URL(path, budgetApiBaseUrl).toString();

const PUBLIC_REVALIDATE_SECONDS = 300;
const IS_LOCAL_MEDIA_PROVIDER = env.publicMediaProvider === "local";

const buildPublicCacheOptions = (tags: string[] = []) => ({
  ...(IS_LOCAL_MEDIA_PROVIDER
    ? {
        cache: "no-store" as const,
        next: {
          revalidate: 0,
          tags,
        },
      }
    : {
        cache: "force-cache" as const,
        next: {
          revalidate: PUBLIC_REVALIDATE_SECONDS,
          tags,
        },
      }),
});

const buildShortPublicCacheOptions = (tags: string[] = []) => ({
  ...(IS_LOCAL_MEDIA_PROVIDER
    ? {
        cache: "no-store" as const,
        next: {
          revalidate: 0,
          tags,
        },
      }
    : {
        cache: "force-cache" as const,
        next: {
          revalidate: 60,
          tags,
        },
      }),
});

const buildPublicTag = (...parts: Array<string | number | null | undefined>) =>
  parts
    .map((part) => (part === null || part === undefined ? "" : String(part).trim()))
    .filter((part) => part.length > 0)
    .join(":");

type DerivedProductPayload = {
  id: string;
  baseProductId: number;
  sizeId: number;
  name: string;
  updatedAt: string;
  description?: string | null;
  images: Array<{
    id: number | string;
    url: string;
    publicId?: string | null;
    version?: number | null;
    alt?: string | null;
  }>;
  width: number;
  height: number;
  area: number;
  unitPricePerM2: number;
  totalPrice: number;
  stock: number;
  currency: string;
  sizeLabel: string;
  slug: string;
  categories?: Array<{ id: number; slug: string; name: string }>;
  measurementType?: "M2";
  isPublic?: boolean;
  isBudgetCalculable?: boolean;
  calculationStrategy?: string;
  tags?: string[];
};

const toInventoryStatus = (stock: number): ProductSummary["inventoryStatus"] => {
  if (!Number.isFinite(stock) || stock <= 0) {
    return "out-of-stock";
  }
  if (stock < 5) {
    return "limited";
  }
  return "in-stock";
};

const mapDerivedProductToSummary = (product: DerivedProductPayload): ProductSummary => {
  const firstImage = product.images[0] ?? null;
  const thumbnailUrl = resolveMediaAssetUrl({
    url: firstImage?.url ?? null,
    publicId: firstImage?.publicId ?? null,
    version: firstImage?.version ?? null,
    type: "image",
  });
  const money = {
    amount: product.totalPrice,
    currency: product.currency,
  };

  return {
    id: product.baseProductId * 1000 + product.sizeId,
    slug: product.slug,
    name: product.name,
    updatedAt: product.updatedAt,
    shortDescription: product.description ?? null,
    price: money,
    salePrice: money,
    inventoryStatus: toInventoryStatus(product.stock),
      thumbnail: thumbnailUrl
      ? {
          id: `${product.id}-thumbnail`,
          url: thumbnailUrl,
          publicId: firstImage?.publicId ?? null,
          version: firstImage?.version ?? null,
          alt: product.images[0]?.alt ?? product.name,
        }
      : undefined,
    categories: (product.categories ?? []).map((category) => ({
      ...category,
      productCount: 0,
    })),
    tags: product.tags ?? [],
    mode: "simple",
    measurementType: product.measurementType ?? "M2",
    isPublic: product.isPublic ?? true,
    isBudgetCalculable: product.isBudgetCalculable ?? true,
    calculationStrategy: product.calculationStrategy ?? "M2",
    images: product.images.map((image, index) => ({
      id: image.id,
      url: image.url,
      alt: image.alt ?? product.name,
      isPrimary: index === 0,
    })),
    gallery: product.images.map((image, index) => ({
      id: image.id,
      url: image.url,
      alt: image.alt ?? product.name,
      isPrimary: index === 0,
    })),
    specifications: [
      { label: "Medida", value: product.sizeLabel },
      { label: "Ancho", value: `${product.width.toFixed(2)} m` },
      { label: "Alto", value: `${product.height.toFixed(2)} m` },
      { label: "Área", value: `${product.area.toFixed(2)} m²` },
    ],
    configuration: {
      derived: true,
      baseProductId: product.baseProductId,
      sizeId: product.sizeId,
      width: product.width,
      height: product.height,
      area: product.area,
      sizeLabel: product.sizeLabel,
    },
  } as ProductSummary;
};

const isBaseParametricProduct = (product: ProductSummary): boolean => {
  if (product.measurementType !== "M2") {
    return false;
  }

  return Boolean((product.configuration as { derived?: boolean } | null | undefined)?.derived) === false;
};

const isCatalogExposureMode = (
  value?: string | null,
): value is "AUTO" | "M2_DERIVED" | "UNITARY" | "EMPTY_IF_NO_PUBLIC_CALCULABLE" =>
  value === "AUTO" ||
  value === "M2_DERIVED" ||
  value === "UNITARY" ||
  value === "EMPTY_IF_NO_PUBLIC_CALCULABLE";

const isM2CatalogExposureMode = (value?: string | null) =>
  value === "M2_DERIVED" || value === "EMPTY_IF_NO_PUBLIC_CALCULABLE";

const findCategoryBySlug = (
  categories: CategorySummary[],
  slug?: string | null,
): CategorySummary | null => {
  const normalized = normalizeSearchValue(slug ?? "");
  if (!normalized) {
    return null;
  }

  for (const category of categories) {
    if (
      normalizeSearchValue(category.slug) === normalized ||
      normalizeSearchValue(category.name) === normalized
    ) {
      return category;
    }

    if (category.children?.length) {
      const child = findCategoryBySlug(category.children, normalized);
      if (child) {
        return child;
      }
    }
  }

  return null;
};

const collectCategorySlugs = (category?: CategorySummary | null): string[] => {
  if (!category) {
    return [];
  }

  const slugs = new Set<string>();
  const stack: CategorySummary[] = [category];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.slug) {
      slugs.add(current.slug);
    }
    if (current.children?.length) {
      stack.push(...current.children);
    }
  }

  return Array.from(slugs);
};

const sortStorefrontProducts = (
  products: ProductSummary[],
  sort?: ProductListQuery["sort"],
): ProductSummary[] => {
  const sorted = [...products];
  switch (sort) {
    case "newest":
      sorted.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      break;
    case "price-asc":
      sorted.sort((a, b) => a.price.amount - b.price.amount);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price.amount - a.price.amount);
      break;
    case "best-sellers":
    case "featured":
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return sorted;
};

const hydrateDerivedProductCategories = (
  product: ProductSummary,
  baseCategories: ProductSummary["categories"],
): ProductSummary => {
  if ((product.categories?.length ?? 0) > 0) {
    return product;
  }

  if ((baseCategories?.length ?? 0) === 0) {
    return product;
  }

  return {
    ...product,
    categories: baseCategories?.map((category) => ({
      ...category,
    })),
  };
};

const filterAndSortProducts = (
  products: ProductSummary[],
  query: ProductListQuery,
  categorySlugs?: Set<string>,
): ProductSummary[] => {
  const categorySlug = query.categorySlug?.trim() ?? "";
  const term = query.search?.trim() ?? "";
  const normalizedTerm = normalizeSearchValue(term);
  const filtered = products.filter((product) => {
    if (isBaseParametricProduct(product)) {
      return false;
    }

    if (categorySlug) {
      const matchesCategory = categorySlugs?.size
        ? product.categories?.some((category) => categorySlugs.has(category.slug))
        : product.categories?.some((category) => category.slug === categorySlug);
      if (!matchesCategory) {
        return false;
      }
    }

    if (term) {
      const haystack = [
        product.name,
        product.shortDescription ?? "",
        product.slug,
        ...(product.tags ?? []),
        ...(product.categories?.map((category) => category.name) ?? []),
      ].join(" ");
      if (!normalizeSearchValue(haystack).includes(normalizedTerm)) {
        return false;
      }
    }

    if (query.tag && !(product.tags ?? []).includes(query.tag)) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered];
  switch (query.sort) {
    case "newest":
      sorted.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      break;
    case "price-asc":
      sorted.sort((a, b) => a.price.amount - b.price.amount);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price.amount - a.price.amount);
      break;
    case "best-sellers":
    case "featured":
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return sorted;
};

export interface StorefrontAddressInput {
  street: string;
  number: string;
  city: string;
  department: string;
  country: string;
  neighborhood?: string | null;
  label?: string | null;
  corner?: string | null;
  apartment?: string | null;
  comments?: string | null;
  isPrimary?: boolean | null;
}

export interface MercadoPagoChargeRequest {
  token: string;
  transactionAmount: number;
  currency: string;
  installments: number;
  paymentMethodId: string;
  payer: {
    email: string;
    identification?: { type: string; number: string };
    firstName?: string;
    lastName?: string;
  };
  issuerId?: string;
  description?: string;
  orderId?: string;
  cartId?: string;
  checkoutToken?: string;
  statementDescriptor?: string;
  checkoutSnapshot?: CheckoutSnapshotPayload;
}

export interface MercadoPagoChargeResponse {
  status: string;
  statusDetail?: string | null;
  paymentId?: string | null;
  paymentIntentId: string;
  cartId?: string | null;
  orderUuid?: string | null;
  orderNumber?: string | null;
  reference?: string | null;
  amount: number;
  currency: string;
  installments?: number | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  cardholderName?: string | null;
  createdAt: string;
}

export interface MercadoPagoPreferenceRequest {
  amount: number;
  currency: string;
  description?: string;
  cartId?: string;
  checkoutToken?: string;
  orderId?: string;
  statementDescriptor?: string;
  payerEmail?: string;
  successUrl?: string;
  failureUrl?: string;
  pendingUrl?: string;
  minInstallments?: number;
  maxInstallments?: number;
  checkoutSnapshot?: CheckoutSnapshotPayload;
}

export interface MercadoPagoPreferenceResponse {
  preferenceId: string;
}

export interface MercadoPagoResolvePaymentRequest {
  externalPaymentId: string;
  cartId?: string;
  checkoutToken?: string;
  payerEmail?: string;
}

export interface GoogleAuthStartResponse {
  url: string;
  state: string;
  expiresAt: string;
}

export interface CreateOrderReviewRequest {
  productId: number;
  variantId?: number | null;
  rating: number;
  title?: string;
  comment: string;
}

export const StorefrontApi = {
  async getConfig(slug?: string): Promise<StorefrontConfig> {
    return apiFetch<StorefrontConfig>("config", {
      params: slug ? { clientSlug: slug } : undefined,
      ...buildPublicCacheOptions([buildPublicTag("storefront", "config", slug ?? "default")])
    });
  },

  async getHomeLayout(layoutKey: string): Promise<HomeLayoutDefinition> {
    return apiFetch<HomeLayoutDefinition>(`home-layouts/${encodeURIComponent(layoutKey)}`, {
      ...buildPublicCacheOptions([buildPublicTag("storefront", "home-layout", layoutKey)])
    });
  },

  async getContentSection(sectionKey: string, locale?: string): Promise<CmsContentSection> {
    return apiFetch<CmsContentSection>(`content/sections/${encodeURIComponent(sectionKey)}`, {
      params: locale ? { locale } : undefined,
      ...buildPublicCacheOptions([buildPublicTag("storefront", "content-section", sectionKey, locale ?? "default")])
    });
  },

  async listContentSections(locale?: string): Promise<CmsContentSection[]> {
    return apiFetch<CmsContentSection[]>("content/sections", {
      params: locale ? { locale } : undefined,
      ...buildPublicCacheOptions([buildPublicTag("storefront", "content-sections", locale ?? "default")])
    });
  },

  async listStories(): Promise<StorySummary[]> {
    return apiFetch<StorySummary[]>("stories", {
      ...buildShortPublicCacheOptions([buildPublicTag("storefront", "stories")]),
    });
  },

  async getStory(slug: string): Promise<StoryDetail> {
    return apiFetch<StoryDetail>(`stories/${encodeURIComponent(slug)}`, {
      ...buildShortPublicCacheOptions([buildPublicTag("storefront", "story", slug)]),
    });
  },

  async listCmsPages(locale?: string): Promise<CmsPublicPageSummary[]> {
    return apiFetch<CmsPublicPageSummary[]>("content/pages", {
      params: locale ? { locale } : undefined,
      ...buildPublicCacheOptions([buildPublicTag("storefront", "cms-pages", locale ?? "default")]),
    });
  },

  async getCmsPage(path = "", locale?: string): Promise<CmsRenderablePage> {
    return apiFetch<CmsRenderablePage>("content/pages/resolve", {
      params: {
        path,
        ...(locale ? { locale } : {}),
      },
      ...buildPublicCacheOptions([buildPublicTag("storefront", "cms-page", path, locale ?? "default")]),
    });
  },

  async listProducts(query: ProductListQuery = {}): Promise<PaginatedResponse<ProductSummary>> {
    if (env.clientSlug === "urucortinas") {
      try {
        const searchTerm = query.search?.trim() ?? "";
        const rawCategorySlug = query.categorySlug?.trim() ?? "";
        const categorySlug = rawCategorySlug.toLowerCase() === "all" ? "" : rawCategorySlug;
        let selectedCategorySlugs: Set<string> | undefined;

        if (categorySlug) {
          const categories = await apiFetch<CategorySummary[]>("categories", {
            ...buildPublicCacheOptions([buildPublicTag("storefront", "categories")]),
          });
          const selectedCategory = findCategoryBySlug(categories, categorySlug);
          const exposureMode = selectedCategory?.catalogExposureMode ?? null;
          selectedCategorySlugs = selectedCategory ? new Set(collectCategorySlugs(selectedCategory)) : undefined;

          if (selectedCategory && isM2CatalogExposureMode(exposureMode)) {
            const derivedProducts = await apiFetch<DerivedProductPayload[]>("m2-derived", {
              ...buildPublicCacheOptions([buildPublicTag("storefront", "m2-derived")]),
            });

            const normalizedDerivedProducts = derivedProducts
              .map((product) => mapDerivedProductToSummary(product))
              .filter((product) =>
                (product.categories ?? []).some((category) => selectedCategorySlugs?.has(category.slug) ?? false),
              );

            const filtered = normalizedDerivedProducts.filter((product) => {
              if (searchTerm) {
                const haystack = [
                  product.name,
                  product.shortDescription ?? "",
                  product.slug,
                  ...(product.tags ?? []),
                ].join(" ");
                if (!normalizeSearchValue(haystack).includes(normalizeSearchValue(searchTerm))) {
                  return false;
                }
              }

              if (query.tag && !(product.tags ?? []).includes(query.tag)) {
                return false;
              }

              return true;
            });

            return buildPaginatedResponse(sortStorefrontProducts(filtered, query.sort), query);
          }

          if (selectedCategory && exposureMode === "UNITARY") {
            return apiFetch<PaginatedResponse<ProductSummary>>("products", {
              params: {
                page: query.page,
                pageSize: query.pageSize,
                category: query.categorySlug,
                search: query.search,
                sort: query.sort,
                tag: query.tag,
              },
              ...buildPublicCacheOptions([
                "products",
                ...(query.categorySlug ? [`category:${query.categorySlug}`] : []),
              ]),
            });
          }
        }

        const [baseProducts, derivedProducts, searchProducts] = await Promise.all([
          loadAllStorefrontProducts(),
          apiFetch<DerivedProductPayload[]>("m2-derived", {
            ...buildPublicCacheOptions([buildPublicTag("storefront", "m2-derived")]),
          }),
          searchTerm ? loadAllStorefrontProducts(searchTerm) : Promise.resolve([] as ProductSummary[]),
        ]);

        const baseCategoriesById = new Map<number, NonNullable<ProductSummary["categories"]>>(
          baseProducts.map((product) => [product.id, product.categories ?? []]),
        );
        const normalizedBaseProducts = baseProducts.filter((product) => !isBaseParametricProduct(product));
        const normalizedDerivedProducts = derivedProducts.map((product) =>
          hydrateDerivedProductCategories(
            mapDerivedProductToSummary(product),
            baseCategoriesById.get(product.baseProductId),
          ),
        );
        const normalizedSearchProducts = searchProducts.filter((product) => !isBaseParametricProduct(product));

        const merged = Array.from(
          new Map(
            [...normalizedBaseProducts, ...normalizedDerivedProducts, ...normalizedSearchProducts].map((product) => [
              product.slug,
              product,
            ]),
          ).values(),
        );

        const filtered = filterAndSortProducts(merged, query, selectedCategorySlugs);
        return buildPaginatedResponse(filtered, query);
      } catch (error) {
        if (isSnapshotFallbackEnabled()) {
          const record = await loadStorefrontSnapshot();
          if (record) {
            const fallbackItems = selectSnapshotProducts(record.value, query);
            if (fallbackItems.length) {
              const status = isApiError(error) ? error.status : "unknown";
              console.warn(
                `[storefront] urucortinas products endpoint unavailable (status: ${status}). Serving snapshot dataset.`,
              );
              const unique = Array.from(
                new Map(fallbackItems.map((item) => [item.slug ?? item.id, item])).values(),
              );
              return buildPaginatedResponse(unique, query);
            }
          }
        }
        throw error;
      }
    }

    try {
      return await apiFetch<PaginatedResponse<ProductSummary>>("products", {
        params: {
          page: query.page,
          pageSize: query.pageSize,
          category: query.categorySlug,
          search: query.search,
          sort: query.sort,
          tag: query.tag
        },
        ...buildPublicCacheOptions([
          "products",
          ...(query.categorySlug ? [`category:${query.categorySlug}`] : [])
        ])
      });
    } catch (error) {
      if (isSnapshotFallbackEnabled()) {
        const record = await loadStorefrontSnapshot();
        if (record) {
          const fallbackItems = selectSnapshotProducts(record.value, query);
          if (fallbackItems.length) {
            const status = isApiError(error) ? error.status : "unknown";
            console.warn(
              `[storefront] products endpoint unavailable (status: ${status}). Serving snapshot dataset.`,
            );
            const unique = Array.from(
              new Map(fallbackItems.map((item) => [item.slug ?? item.id, item])).values(),
            );
            return buildPaginatedResponse(unique, query);
          }
        }
      }
      throw error;
    }
  },

  async getProduct(slugOrId: string, tagSlug?: string): Promise<ProductDetail> {
    return apiFetch<ProductDetail>(`products/${encodeURIComponent(slugOrId)}`, {
      ...buildPublicCacheOptions([`product:${tagSlug ?? slugOrId}`, "products"])
    });
  },

  async getProductMedia(slugOrId: string, tagSlug?: string): Promise<StorefrontProductMediaResponse> {
    return apiFetch<StorefrontProductMediaResponse>(`products/${encodeURIComponent(slugOrId)}/media`, {
      ...buildPublicCacheOptions([`product:${tagSlug ?? slugOrId}`, "products"])
    });
  },

  async listProductsWithMedia(): Promise<StorefrontProductMediaResponse[]> {
    return apiFetch<StorefrontProductMediaResponse[]>("products-with-media", {
      ...buildPublicCacheOptions(["products"])
    });
  },

  async listAllProducts(): Promise<ProductSummary[]> {
    return loadAllStorefrontProducts();
  },

  async listShippingOptions(): Promise<StorefrontShippingOption[]> {
    return apiFetch<StorefrontShippingOption[]>("shipping-options", {
      ...buildPublicCacheOptions([buildPublicTag("storefront", "shipping-options")])
    });
  },

  async getProductParametricConfig(productId: number): Promise<ParametricConfigSnapshot> {
    return apiFetch<ParametricConfigSnapshot>(`products/${productId}/parametric-config`, {
      ...buildPublicCacheOptions([buildPublicTag("storefront", "product-parametric-config", productId)])
    });
  },

  async listBudgetProducts(): Promise<BudgetProductSummary[]> {
    return apiFetch<BudgetProductSummary[]>(budgetApiUrl("products"), {
      ...buildPublicCacheOptions([buildPublicTag("storefront", "budget-products")])
    });
  },

  async calculateBudgetProduct(payload: {
    productId: number;
    width: number;
    height: number;
    currency?: string;
  }): Promise<BudgetCalculationResult> {
    return apiFetch<BudgetCalculationResult>(budgetApiUrl("calculate"), {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  },

  async addBudgetToCart(payload: BudgetAddToCartRequest): Promise<BudgetAddToCartResponse> {
    return apiFetch<BudgetAddToCartResponse>(budgetApiUrl("add-to-cart"), {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  },

  async summarizeBudget(payload: BudgetSummaryRequest): Promise<BudgetSummaryResponse> {
    return apiFetch<BudgetSummaryResponse>(budgetApiUrl("summary"), {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  },

  async saveBudgetLead(payload: BudgetLeadRequest): Promise<BudgetLeadResponse> {
    return apiFetch<BudgetLeadResponse>(budgetApiUrl("lead"), {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  },

  async quoteParametricProduct(
    productId: number,
    payload: ParametricQuoteRequest
  ): Promise<ParametricQuoteResult> {
    return apiFetch<ParametricQuoteResult>(`products/${productId}/parametric-quote`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });
  },

  async listCategories(): Promise<CategorySummary[]> {
    try {
      return await apiFetch<CategorySummary[]>("categories", {
        ...buildPublicCacheOptions([buildPublicTag("storefront", "categories")])
      });
    } catch (error) {
      if (isSnapshotFallbackEnabled()) {
        const fallback = await loadFallbackCategoriesFromSnapshot();
        if (fallback.length) {
          const status = isApiError(error) ? error.status : "unknown";
          console.warn(
            `[storefront] categories endpoint unavailable (status: ${status}). Serving snapshot dataset.`,
          );
          return fallback;
        }
      }
      throw error;
    }
  },

  async getRecommendations(productId: number, limit = 8): Promise<ProductSummary[]> {
    return apiFetch<ProductSummary[]>(`products/${productId}/recommendations`, {
      params: { limit },
      ...buildPublicCacheOptions(["products"])
    });
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
      cache: "no-store"
    });
  },

  async logout(): Promise<void> {
    await apiFetch("auth/logout", {
      method: "POST",
      cache: "no-store"
    });
  },

  async register(
    payload: {
      email?: string;
      password: string;
      firstName: string;
      lastName: string;
      phone: string;
      locale?: string;
    }
  ): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  },

  async startGoogleLogin(returnPath?: string): Promise<GoogleAuthStartResponse> {
    return apiFetch<GoogleAuthStartResponse>("auth/google/start", {
      method: "POST",
      body: JSON.stringify(returnPath ? { returnPath } : {}),
      cache: "no-store"
    });
  },

  async getCurrentSession(): Promise<AuthSession | null> {
    return apiFetch<AuthSession | null>("auth/session", {
      cache: "no-store"
    });
  },

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      cache: "no-store"
    });
  },

  async requestPasswordRecoveryByEmail(email: string): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>("auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ channel: "email", email }),
      cache: "no-store"
    });
  },

  async resetPasswordByEmail(token: string, newPassword: string): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>("auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ channel: "email", token, newPassword }),
      cache: "no-store"
    });
  },

  async confirmEmailVerification(token: string): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>("auth/email-verification/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
      cache: "no-store"
    });
  },

  async resendEmailVerification(token: string): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>("auth/email-verification/resend", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async createOrder(payload: CreateOrderPayload): Promise<OrderSummary> {
    return apiFetch<OrderSummary>("orders", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  },

  async createOrderReview(
    orderIdentifier: string,
    payload: CreateOrderReviewRequest
  ): Promise<{ id: number }> {
    return apiFetch<{ id: number }>(`account/orders/${encodeURIComponent(orderIdentifier)}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  },

  async previewCheckout(payload: CheckoutSnapshotPayload): Promise<CheckoutSummary> {
    return apiFetch<CheckoutSummary>("checkout/preview", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  },

  async listNotifications(
    token: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<CustomerNotificationList> {
    return apiFetch<CustomerNotificationList>("account/notifications", {
      params,
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getNotificationUnreadCount(token: string): Promise<{ count: number }> {
    return apiFetch<{ count: number }>("account/notifications/unread-count", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async markNotificationsRead(
    token: string,
    payload: { ids?: number[]; markAll?: boolean }
  ): Promise<void> {
    await apiFetch("account/notifications/read", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async deleteNotifications(
    token: string,
    payload: { ids?: number[]; deleteAll?: boolean }
  ): Promise<void> {
    await apiFetch("account/notifications", {
      method: "DELETE",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async deleteNotification(token: string, id: number): Promise<void> {
    await apiFetch(`account/notifications/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async createMercadoPagoCharge(
    payload: MercadoPagoChargeRequest,
    options: { idempotencyKey?: string } = {}
  ): Promise<MercadoPagoChargeResponse> {
    const headers: Record<string, string> = {};
    if (options.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }
    return apiFetch(
      "payments/mercadopago/charge",
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers,
        cache: "no-store"
      }
    );
  },

  async createMercadoPagoPreference(
    payload: MercadoPagoPreferenceRequest
  ): Promise<MercadoPagoPreferenceResponse> {
    return apiFetch(
      "payments/mercadopago/preference",
      {
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );
  },

  async resolveMercadoPagoPayment(
    payload: MercadoPagoResolvePaymentRequest
  ): Promise<MercadoPagoChargeResponse> {
    return apiFetch(
      "payments/mercadopago/resolve",
      {
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );
  },

  async getAccountProfile(token: string): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>("account/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async updateAccountProfile(
    token: string,
    payload: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      dateOfBirth?: string | null;
      locale?: string | null;
    }
  ): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>("account/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async listOrders(token: string): Promise<PublicOrderSummary[]> {
    return apiFetch<PublicOrderSummary[]>("account/orders", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getOrder(token: string, identifier: string): Promise<PublicOrderSummary> {
    return apiFetch<PublicOrderSummary>(`account/orders/${encodeURIComponent(identifier)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getOrderTimeline(token: string, identifier: string): Promise<OrderTimelineResponse> {
    return apiFetch<OrderTimelineResponse>(
      `account/orders/${encodeURIComponent(identifier)}/timeline`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      },
    );
  },

  async listAddresses(token: string) {
    return apiFetch<CustomerProfile["addresses"]>("account/addresses", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async createAddress(token: string, payload: StorefrontAddressInput): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>("account/addresses", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async updateAddress(token: string, addressId: number, payload: StorefrontAddressInput): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>(`account/addresses/${addressId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async deleteAddress(token: string, addressId: number): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>(`account/addresses/${addressId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async setPrimaryAddress(token: string, addressId: number): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>(`account/addresses/${addressId}/set-primary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getWishlist(token: string): Promise<CustomerWishlist> {
    return apiFetch<CustomerWishlist>("account/wishlist", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async addWishlistItem(token: string, productId: number): Promise<CustomerWishlist> {
    return apiFetch<CustomerWishlist>("account/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async removeWishlistItem(token: string, productId: number): Promise<CustomerWishlist> {
    return apiFetch<CustomerWishlist>(`account/wishlist/${productId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getCurrencySettings(): Promise<{
    baseCurrency: string;
    enabledCurrencies: string[];
    rates: Record<string, number>;
    generatedAt: string;
  }> {
    return apiFetch("currencies", {
      cache: "no-store"
    });
  }
};

export { isApiError } from "@/lib/http";
