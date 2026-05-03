import type { Metadata } from "next";
import { headers } from "next/headers";
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
import { ALL_CATEGORY_SLUG, isAllCategorySlug } from "@/lib/storefront/category-slugs";

export const revalidate = 180;
export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Catálogo",
    description: "Explora el catálogo público de productos y filtra por categoría, búsqueda o precio.",
    canonicalPath: "/shop",
  });
}

const PAGE_SIZE = 28;
const MOBILE_PAGE_SIZE = 12;
type SaleCategoryDefinition = {
  icon: string;
  title: string;
  slug?: string;
};

const DEFAULT_SALE_CATEGORIES: SaleCategoryDefinition[] = [{ icon: "category", title: "All", slug: ALL_CATEGORY_SLUG }];

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

  return [{ icon: "category", title: "All", slug: ALL_CATEGORY_SLUG }, ...mapped];
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

const isMobileListingRequest = () => {
  const userAgent = headers().get("user-agent")?.toLowerCase() ?? "";
  return /mobile|iphone|ipod|android.*mobile|iemobile|blackberry|opera mini/.test(userAgent);
};

export default async function ShopPage({ searchParams }: SearchParams) {
  const config = await getStorefrontConfig();
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const requestedPage = pageParam ? Math.max(Number(pageParam), 1) : 1;
  const categoryParam = Array.isArray(params?.category) ? params?.category[0] : params?.category;
  const selectedCategorySlug =
    typeof categoryParam === "string" && categoryParam.trim().length > 0
      ? categoryParam.trim().toLowerCase()
      : ALL_CATEGORY_SLUG;
  const searchTerm = extractSearchTerm(params ?? {});
  const sort = extractSortParam(params?.sort);
  const priceMin = parseNumberParam(params?.priceMin ?? params?.minPrice ?? params?.price_min);
  const priceMax = parseNumberParam(params?.priceMax ?? params?.maxPrice ?? params?.price_max);
  const rating = parseNumberParam(params?.rating);
  const pageSize = isMobileListingRequest() ? MOBILE_PAGE_SIZE : PAGE_SIZE;

  let products: Product[] = [];
  let meta: Meta = { page: requestedPage, pageSize, total: 0, totalPage: 1 };
  let saleCategories: SaleCategoryDefinition[] = DEFAULT_SALE_CATEGORIES;
  let selectedCategoryLabel: string | undefined;

  try {
    const categories = await StorefrontApi.listCategories();
    const mapped = mapCategoriesForSale(categories);
    if (mapped.length > 0) {
      saleCategories = mapped;
    }
    selectedCategoryLabel = isAllCategorySlug(selectedCategorySlug)
      ? undefined
      : mapped.find((category) => category.slug === selectedCategorySlug)?.title;
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Failed to load storefront categories.", error);
    }
    saleCategories = DEFAULT_SALE_CATEGORIES;
  }

  try {
    const storefrontPage = await StorefrontApi.listProducts({
      page: requestedPage,
      pageSize,
      categorySlug: isAllCategorySlug(selectedCategorySlug) ? undefined : selectedCategorySlug,
      search: searchTerm,
      sort,
      priceMin,
      priceMax,
      rating,
    });

    products = storefrontPage.data.map(mapProductSummaryToProduct);
    meta = {
      page: storefrontPage.page,
      pageSize: storefrontPage.pageSize,
      total: storefrontPage.total,
      totalPage: storefrontPage.totalPages,
    };
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Failed to load storefront products.", error);
    }
    products = [];
    meta = { page: requestedPage, pageSize, total: 0, totalPage: 1 };
  }

  const availablePriceBounds = priceBoundsFromProducts(products);
  const appliedFilters: ActiveFilters = {
    priceMin,
    priceMax,
    rating: typeof rating === "number" && rating > 0 ? Math.min(Math.max(Math.floor(rating), 1), 5) : undefined
  };

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
