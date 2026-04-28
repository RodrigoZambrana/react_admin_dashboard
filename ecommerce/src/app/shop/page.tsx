import type { Metadata } from "next";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import StructuredData from "@/components/seo/StructuredData";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { buildCollectionPageJsonLd } from "@/lib/seo/structured-data";
import { resolveAbsoluteUrl } from "@/lib/seo/urls";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import Container from "@component/Container";
import Hidden from "@component/hidden";

import SaleNavbar from "@sections/sale-page-1/SaleNavbar";
import SaleCategory from "@sections/sale-page-1/SaleCategory";
import ShopProductArea from "./components/ShopProductArea";

import type Product from "@models/product.model";
import { Meta, SearchParams } from "interfaces";
import type { CategorySummary, ProductListQuery } from "@/types/storefront";
import type { ActiveFilters, PriceFilter } from "./components/ShopFilterPanel";
import {
  buildSearchCategoryOptions,
  findMatchingSearchCategories,
} from "@/lib/storefront/search-utils";

export const revalidate = 180;
export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Catálogo",
    description: "Explora el catálogo público de productos y filtra por categoría, búsqueda o precio.",
    canonicalPath: "/shop",
  });
}

const PAGE_SIZE = 28;
type SaleCategoryDefinition = {
  icon: string;
  title: string;
  slug?: string;
};

const DEFAULT_SALE_CATEGORIES: SaleCategoryDefinition[] = [{ icon: "category", title: "All" }];

const SALE_CATEGORY_ICONS = ["women-dress", "beauty-products", "camera", "sofa"];

const mapCategoriesForSale = (categories: CategorySummary[]): SaleCategoryDefinition[] => {
  const rootCategories = categories.filter((category) => !category.parentId);
  if (rootCategories.length === 0) return [];

  const mapped = rootCategories
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category, index) => ({
      title: category.name,
      icon: SALE_CATEGORY_ICONS[index % SALE_CATEGORY_ICONS.length],
      slug: category.slug
    }));

  return [{ icon: "category", title: "All" }, ...mapped];
};

const parseNumberParam = (input: string | string[] | undefined): number | undefined => {
  const value = Array.isArray(input) ? input[0] : input;
  if (!value) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
};

const extractSortParam = (
  input: string | string[] | undefined,
): ProductListQuery["sort"] | undefined => {
  const value = Array.isArray(input) ? input[0] : input;
  switch (value) {
    case "newest":
    case "price-asc":
    case "price-desc":
    case "featured":
    case "best-sellers":
      return value;
    default:
      return undefined;
  }
};

const extractSearchTerm = (params: Record<string, string | string[] | undefined>): string | undefined => {
  const candidate = params.query ?? params.search;
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const priceBoundsFromProducts = (products: Product[]): PriceFilter => {
  if (products.length === 0) return {};

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const product of products) {
    const price = typeof product.salePrice === "number" ? product.salePrice : product.price;
    if (typeof price !== "number" || Number.isNaN(price)) continue;
    if (price < min) min = price;
    if (price > max) max = price;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return {};
  }

  return { min, max };
};

const applyProductFilters = (products: Product[], filters: ActiveFilters): Product[] => {
  const { priceMin, priceMax, rating } = filters;

  return products.filter((product) => {
    const productPrice = typeof product.salePrice === "number" ? product.salePrice : product.price;
    const productRating = typeof product.rating === "number" ? product.rating : 0;

    if (typeof priceMin === "number" && productPrice < priceMin) return false;
    if (typeof priceMax === "number" && productPrice > priceMax) return false;
    if (typeof rating === "number" && rating > 0 && productRating < rating) return false;
    return true;
  });
};

const paginateProducts = (products: Product[], currentPage: number, pageSize: number) => {
  const total = products.length;
  const totalPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPage);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: products.slice(start, end),
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPage
    } satisfies Meta
  };
};

const fetchStorefrontProducts = async (
  query: ProductListQuery,
  pageSize: number
): Promise<{ products: Product[]; total: number }> => {
  const baseQuery = { ...query, pageSize };
  const firstPage = await StorefrontApi.listProducts({ ...baseQuery, page: 1 });

  const responses: typeof firstPage[] = [firstPage];

  if (firstPage.totalPages > 1) {
    const remainingPages = Array.from({ length: firstPage.totalPages - 1 }, (_, index) => index + 2);
    const settled = await Promise.allSettled(
      remainingPages.map((page) => StorefrontApi.listProducts({ ...baseQuery, page }))
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        responses.push(result.value);
      } else if (!isApiError(result.reason)) {
        console.warn("[shop-page] Failed to fetch additional product pages", result.reason);
      }
    }
  }

  const summaries = responses.flatMap((response) => response.data);
  return {
    products: summaries.map(mapProductSummaryToProduct),
    total: firstPage.total
  };
};

const dedupeProducts = (products: Product[]) =>
  Array.from(new Map(products.map((product) => [product.id, product])).values());

export default async function ShopPage({ searchParams }: SearchParams) {
  const config = await getStorefrontConfig();
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const requestedPage = pageParam ? Math.max(Number(pageParam), 1) : 1;
  const categoryParam = Array.isArray(params?.category) ? params?.category[0] : params?.category;
  const selectedCategorySlug = typeof categoryParam === "string" && categoryParam.length > 0
    ? categoryParam
    : undefined;
  const searchTerm = extractSearchTerm(params ?? {});
  const sort = extractSortParam(params?.sort);
  const priceMin = parseNumberParam(params?.priceMin ?? params?.minPrice ?? params?.price_min);
  const priceMax = parseNumberParam(params?.priceMax ?? params?.maxPrice ?? params?.price_max);
  const rating = parseNumberParam(params?.rating);

  let products: Product[] = [];
  let meta: Meta = { page: requestedPage, pageSize: PAGE_SIZE, total: 0, totalPage: 1 };
  let saleCategories: SaleCategoryDefinition[] = DEFAULT_SALE_CATEGORIES;
  let allProducts: Product[] = [];
  let selectedCategoryLabel: string | undefined;
  let matchedCategorySlugs: string[] = [];

  try {
    const categories = await StorefrontApi.listCategories();
    const mapped = mapCategoriesForSale(categories);
    if (mapped.length > 0) {
      saleCategories = mapped;
    }
    selectedCategoryLabel = selectedCategorySlug
      ? mapped.find((category) => category.slug === selectedCategorySlug)?.title
      : undefined;

    if (!selectedCategorySlug && searchTerm) {
      const searchCategoryOptions = buildSearchCategoryOptions(categories);
      matchedCategorySlugs = findMatchingSearchCategories(searchCategoryOptions, searchTerm)
        .map((category) => category.slug)
        .filter((slug): slug is string => Boolean(slug));
    }
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Failed to load storefront categories.", error);
    }
    saleCategories = DEFAULT_SALE_CATEGORIES;
  }

  try {
    const productSources = [
      fetchStorefrontProducts(
        {
          categorySlug: selectedCategorySlug,
          search: searchTerm,
          sort,
        },
        PAGE_SIZE
      ),
    ];

    if (!selectedCategorySlug && searchTerm && matchedCategorySlugs.length > 0) {
      const extraCategorySources = matchedCategorySlugs.slice(0, 3).map((slug) =>
        fetchStorefrontProducts(
          {
            categorySlug: slug,
            sort,
          },
          PAGE_SIZE
        )
      );
      productSources.push(...extraCategorySources);
    }

    const settled = await Promise.allSettled(productSources);
    const storefrontProducts = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value.products : []
    );

    allProducts = dedupeProducts(storefrontProducts);
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Failed to load storefront products.", error);
    }
    allProducts = [];
  }

  const normalizeText = (value?: string) => (value ? value.toLowerCase() : "");
  const normalizedSearchTerm = searchTerm ? normalizeText(searchTerm) : undefined;

  let scopedProducts = allProducts;

  if (normalizedSearchTerm && matchedCategorySlugs.length === 0) {
    scopedProducts = scopedProducts.filter((product) =>
      normalizeText(product.title).includes(normalizedSearchTerm) ||
      normalizeText(product.slug).includes(normalizedSearchTerm)
    );
  }

  const availablePriceBounds = priceBoundsFromProducts(scopedProducts);
  const appliedFilters: ActiveFilters = {
    priceMin,
    priceMax,
    rating: typeof rating === "number" && rating > 0 ? Math.min(Math.max(Math.floor(rating), 1), 5) : undefined
  };

  const filteredProducts = applyProductFilters(scopedProducts, appliedFilters);
  const { items: paginatedProducts, meta: paginatedMeta } = paginateProducts(
    filteredProducts,
    requestedPage,
    PAGE_SIZE
  );

  products = paginatedProducts;
  meta = paginatedMeta;

  return (
    <>
      <StructuredData
        schemas={[
          buildCollectionPageJsonLd(config, {
            name: "Catálogo",
            description:
              "Explora el catálogo público de productos y filtra por categoría, búsqueda o precio.",
            url: resolveAbsoluteUrl("/shop", config),
          }),
        ]}
      />
      <Container mt="2rem">
        <SaleNavbar categories={saleCategories} selectedSlug={selectedCategorySlug} />

        <Hidden down="sm">
          <SaleCategory categories={saleCategories} selectedSlug={selectedCategorySlug} />
        </Hidden>

        <ShopProductArea
          products={products}
          meta={meta}
          selectedCategorySlug={selectedCategorySlug}
          selectedCategoryLabel={selectedCategoryLabel}
          searchTerm={searchTerm}
          categories={saleCategories}
          filters={{ priceBounds: availablePriceBounds, active: appliedFilters }}
        />
      </Container>
    </>
  );
}
