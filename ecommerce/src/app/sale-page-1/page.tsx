import axios from "@lib/axios";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { flattenCategorySummaries } from "@/lib/storefront/adapters";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";

import FlexBox from "@component/FlexBox";
import { H1 } from "@component/Typography";
import Container from "@component/Container";

import SaleNavbar from "@sections/sale-page-1/SaleNavbar";
import SaleCategory from "@sections/sale-page-1/SaleCategory";
import SaleProducts from "@sections/sale-page-1/SaleProducts";

import type Product from "@models/product.model";
import { Meta, SearchParams } from "interfaces";

const PAGE_SIZE = 28;

const FALLBACK_SALE_CATEGORIES = [
  { icon: "women-dress", title: "Women" },
  { icon: "beauty-products", title: "Cosmetics" },
  { icon: "camera", title: "Electronics" },
  { icon: "sofa", title: "Furniture" }
];

const SALE_CATEGORY_ICONS = ["women-dress", "beauty-products", "camera", "sofa"];

const mapCategoriesForSale = (names: string[]) =>
  names.slice(0, SALE_CATEGORY_ICONS.length).map((name, index) => ({
    title: name,
    icon: SALE_CATEGORY_ICONS[index % SALE_CATEGORY_ICONS.length]
  }));

export default async function SalePage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const pageParam = Array.isArray(params?.page) ? params?.page[0] : params?.page;
  const currentPage = pageParam ? Math.max(Number(pageParam), 1) : 1;

  let products: Product[] = [];
  let meta: Meta = { page: currentPage, pageSize: PAGE_SIZE, total: 0, totalPage: 1 };
  let saleCategories = FALLBACK_SALE_CATEGORIES;

  let shouldFallbackToMockProducts = false;

  try {
    const response = await StorefrontApi.listProducts({ page: currentPage, pageSize: PAGE_SIZE });
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
    const flattened = flattenCategorySummaries(categories);
    if (flattened.length > 0) {
      const mapped = mapCategoriesForSale(flattened.map((category) => category.name));
      if (mapped.length > 0) {
        saleCategories = mapped;
      }
    }
  } catch (error) {
    if (!isApiError(error)) {
      console.warn("[sale-page] Falling back to template categories:", error);
    }
    saleCategories = FALLBACK_SALE_CATEGORIES;
  }

  return (
    <Container mt="2rem">
      <SaleNavbar categories={saleCategories} />

      <div>
        <FlexBox mb="2rem" flexWrap="wrap">
          <H1 color="primary.main" mr="0.5rem" lineHeight="1">
            Flash Deals,
          </H1>

          <H1 color="text.muted" lineHeight="1">
            Enjoy Upto 80% discounts
          </H1>
        </FlexBox>

        <SaleCategory categories={saleCategories} />
      </div>

      <SaleProducts products={products} meta={meta} />
    </Container>
  );
}
