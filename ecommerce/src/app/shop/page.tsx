import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";

export const revalidate = 180;

import FlexBox from "@component/FlexBox";
import { H1 } from "@component/Typography";
import Container from "@component/Container";
import Hidden from "@component/hidden";

import SaleNavbar from "@sections/sale-page-1/SaleNavbar";
import SaleCategory from "@sections/sale-page-1/SaleCategory";
import ShopProductArea from "./components/ShopProductArea";

import type Product from "@models/product.model";
import { Meta, SearchParams } from "interfaces";
import type { CategorySummary, ProductListQuery } from "@/types/storefront";
import type { ActiveFilters, PriceFilter } from "./components/ShopFilterPanel";

const PAGE_SIZE = 28;
const ALLOW_MOCK_PRODUCTS =
  process.env.NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS === "true" ||
  process.env.ENABLE_STOREFRONT_FALLBACKS === "true";

type SaleCategoryDefinition = {
  icon: string;
  title: string;
  slug?: string;
};

const FALLBACK_SALE_CATEGORIES: SaleCategoryDefinition[] = [
  { icon: "women-dress", title: "Women" },
  { icon: "beauty-products", title: "Cosmetics" },
  { icon: "camera", title: "Electronics" },
  { icon: "sofa", title: "Furniture" }
];

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

const loadMockProducts = async (): Promise<Product[]> => {
  const module = await import("@/__server__/__db__/products/data");
  const dataset = module?.uniqueProudcts ?? [];
  return Array.isArray(dataset) ? (dataset as Product[]) : [];
};

const fetchMockProducts = async (pageSize: number): Promise<Product[]> => {
  if (!ALLOW_MOCK_PRODUCTS) {
    return [];
  }

  const dataset = await loadMockProducts();
  if (dataset.length === 0) {
    return [];
  }

  const required = Math.max(pageSize, dataset.length);
  return dataset.slice(0, required);
};

export default async function ShopPage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const requestedPage = pageParam ? Math.max(Number(pageParam), 1) : 1;
  const categoryParam = Array.isArray(params?.category) ? params?.category[0] : params?.category;
  const selectedCategorySlug = typeof categoryParam === "string" && categoryParam.length > 0
    ? categoryParam
    : undefined;
  const searchTerm = extractSearchTerm(params ?? {});
  const priceMin = parseNumberParam(params?.priceMin ?? params?.minPrice ?? params?.price_min);
  const priceMax = parseNumberParam(params?.priceMax ?? params?.maxPrice ?? params?.price_max);
  const rating = parseNumberParam(params?.rating);

  let products: Product[] = [];
  let meta: Meta = { page: requestedPage, pageSize: PAGE_SIZE, total: 0, totalPage: 1 };
  let saleCategories: SaleCategoryDefinition[] = FALLBACK_SALE_CATEGORIES;

  let shouldFallbackToMockProducts = false;
  let allProducts: Product[] = [];

  try {
    const { products: storefrontProducts } = await fetchStorefrontProducts(
      {
        categorySlug: selectedCategorySlug,
        search: searchTerm
      },
      PAGE_SIZE
    );

    allProducts = storefrontProducts;

    if (ALLOW_MOCK_PRODUCTS && allProducts.length === 0) {
      shouldFallbackToMockProducts = true;
    }
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Falling back to template products:", error);
    }
    shouldFallbackToMockProducts = ALLOW_MOCK_PRODUCTS;
  }

  if (shouldFallbackToMockProducts && ALLOW_MOCK_PRODUCTS) {
    allProducts = await fetchMockProducts(PAGE_SIZE);
  }

  try {
    const categories = await StorefrontApi.listCategories();
    const mapped = mapCategoriesForSale(categories);
    if (mapped.length > 0) {
      saleCategories = mapped;
    }
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Falling back to template categories:", error);
    }
    saleCategories = FALLBACK_SALE_CATEGORIES;
  }

  const normalizeText = (value?: string) => (value ? value.toLowerCase() : "");
  const normalizedSearchTerm = searchTerm ? normalizeText(searchTerm) : undefined;

  let scopedProducts = allProducts;

  if (selectedCategorySlug) {
    scopedProducts = scopedProducts.filter((product) =>
      product.categories?.some((category) => category?.slug === selectedCategorySlug)
    );
  }

  if (normalizedSearchTerm) {
    scopedProducts = scopedProducts.filter((product) =>
      normalizeText(product.title).includes(normalizedSearchTerm) ||
      normalizeText(product.slug).includes(normalizedSearchTerm)
    );
  }

  const availablePriceBounds = priceBoundsFromProducts(scopedProducts);
  const appliedFilters: ActiveFilters = {
    priceMin:
      typeof priceMin === "number" && typeof availablePriceBounds.min === "number"
        ? Math.max(priceMin, availablePriceBounds.min)
        : priceMin,
    priceMax:
      typeof priceMax === "number" && typeof availablePriceBounds.max === "number"
        ? Math.min(priceMax, availablePriceBounds.max)
        : priceMax,
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
    <Container mt="2rem">
      <SaleNavbar categories={saleCategories} selectedSlug={selectedCategorySlug} />

      <div>
        <FlexBox mb="2rem" flexWrap="wrap">
          <H1 color="primary.main" mr="0.5rem" lineHeight="1">
            Flash Deals,
          </H1>

          <H1 color="text.muted" lineHeight="1">
            Enjoy Upto 80% discounts
          </H1>
        </FlexBox>

        <Hidden down="sm">
          <SaleCategory categories={saleCategories} selectedSlug={selectedCategorySlug} />
        </Hidden>
      </div>

      <ShopProductArea
        products={products}
        meta={meta}
        selectedCategorySlug={selectedCategorySlug}
        categories={saleCategories}
        filters={{ priceBounds: availablePriceBounds, active: appliedFilters }}
      />
    </Container>
  );
}
