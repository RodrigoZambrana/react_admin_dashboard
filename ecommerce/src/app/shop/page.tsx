import axios from "@lib/axios";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";

import FlexBox from "@component/FlexBox";
import { H1 } from "@component/Typography";
import Container from "@component/Container";

import SaleNavbar from "@sections/sale-page-1/SaleNavbar";
import SaleCategory from "@sections/sale-page-1/SaleCategory";
import SaleProducts from "@sections/sale-page-1/SaleProducts";

import type Product from "@models/product.model";
import { Meta, SearchParams } from "interfaces";
import type { CategorySummary } from "@/types/storefront";

const PAGE_SIZE = 28;

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

export default async function ShopPage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const currentPage = pageParam ? Math.max(Number(pageParam), 1) : 1;
  const categoryParam = Array.isArray(params?.category) ? params?.category[0] : params?.category;
  const selectedCategorySlug = typeof categoryParam === "string" && categoryParam.length > 0
    ? categoryParam
    : undefined;

  let products: Product[] = [];
  let meta: Meta = { page: currentPage, pageSize: PAGE_SIZE, total: 0, totalPage: 1 };
  let saleCategories: SaleCategoryDefinition[] = FALLBACK_SALE_CATEGORIES;

  let shouldFallbackToMockProducts = false;

  try {
    const response = await StorefrontApi.listProducts({
      page: currentPage,
      pageSize: PAGE_SIZE,
      categorySlug: selectedCategorySlug
    });
    products = response.data.map(mapProductSummaryToProduct);
    meta = {
      page: response.page,
      pageSize: response.pageSize,
      total: response.total,
      totalPage: response.totalPages
    };

    if (products.length === 0) {
      shouldFallbackToMockProducts = true;
    }
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Falling back to template products:", error);
    }
    shouldFallbackToMockProducts = true;
  }

  if (shouldFallbackToMockProducts) {
    const { data } = await axios.get("/api/products", {
      params: { page: currentPage, pageSize: PAGE_SIZE }
    });

    products = data.result as Product[];
    meta = data.meta as Meta;
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

        <SaleCategory categories={saleCategories} selectedSlug={selectedCategorySlug} />
      </div>

      <SaleProducts
        products={products}
        meta={meta}
        selectedCategorySlug={selectedCategorySlug}
      />
    </Container>
  );
}
