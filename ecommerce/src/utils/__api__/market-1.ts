import Brand from "@models/Brand.model";
import Category from "@models/category.model";
import MainCarouselItem from "@models/market-1.model";
import Product from "@models/product.model";
import Service from "@models/service.model";
import Shop from "@models/shop.model";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import {
  flattenCategorySummaries,
  mapCategorySummaryToCategory,
  mapProductSummaryToProduct,
} from "@/lib/storefront/adapters";

const failFastEnvValue =
  process.env.NEXT_PUBLIC_STOREFRONT_FAIL_FAST ??
  process.env.STOREFRONT_FAIL_FAST ??
  "false";

const ENFORCE_FAIL_FAST = failFastEnvValue === "true" || failFastEnvValue === "1";
const DEFAULT_PRODUCT_PAGE_SIZE = 12;

const toError = (error: unknown, fallbackMessage: string) =>
  error instanceof Error ? error : new Error(fallbackMessage);

const handleFallbackDisabled = <T>(context: string, error: unknown, emptyValue: T): T => {
  if (ENFORCE_FAIL_FAST) {
    throw toError(error, context);
  }

  if (isApiError(error)) {
    console.warn(
      `[storefront] ${context} (status ${error.status}). Returning empty dataset because fallbacks are disabled.`,
    );
  } else if (error instanceof Error) {
    console.warn(
      `[storefront] ${context}: ${error.message}. Returning empty dataset because fallbacks are disabled.`,
    );
  } else {
    console.warn(
      `[storefront] ${context}. Returning empty dataset because fallbacks are disabled.`,
    );
  }

  return emptyValue;
};

const listProducts = async (
  params: Parameters<typeof StorefrontApi.listProducts>[0],
  context: string,
): Promise<Product[]> => {
  try {
    const response = await StorefrontApi.listProducts(params);
    return response.data.map(mapProductSummaryToProduct);
  } catch (error) {
    return handleFallbackDisabled<Product[]>(context, error, []);
  }
};

const listCategories = async (context: string): Promise<Category[]> => {
  try {
    const categories = await StorefrontApi.listCategories();
    return flattenCategorySummaries(categories).map(mapCategorySummaryToCategory);
  } catch (error) {
    return handleFallbackDisabled<Category[]>(context, error, []);
  }
};

const normalizeProductPricing = (product: Product): Product => {
  if (product.basePrice) {
    const basePrice = product.basePrice;
    const salePrice = typeof product.salePrice === "number" ? product.salePrice : product.price;
    const discount =
      typeof product.discount === "number" && product.discount > 0
        ? product.discount
        : basePrice > 0
          ? Math.max(0, Math.round(((basePrice - salePrice) / basePrice) * 100))
          : 0;

    return {
      ...product,
      price: basePrice,
      discount,
    };
  }

  return product;
};

const getTopRatedProduct = async (): Promise<Product[]> =>
  listProducts({ sort: "best-sellers", pageSize: 8 }, "Failed to load top rated products");

const getTopRatedBrand = async (): Promise<Brand[]> => [];

const getNewArrivalList = async (): Promise<Product[]> =>
  listProducts({ sort: "newest", pageSize: DEFAULT_PRODUCT_PAGE_SIZE }, "Failed to load new arrivals");

const getCarBrands = async (): Promise<Brand[]> => [];

const getCarList = async (): Promise<Product[]> => [];

const getMobileBrands = async (): Promise<Brand[]> => [];

const getMobileShops = async (): Promise<Shop[]> => [];

const getMobileList = async (): Promise<Product[]> => [];

const getOpticsBrands = async (): Promise<Brand[]> => [];

const getOpticsShops = async (): Promise<Shop[]> => [];

const getOpticsList = async (): Promise<Product[]> => [];

const getCategories = async (): Promise<Category[]> => {
  const categories = await listCategories("Failed to load storefront categories");
  return categories.filter((category) => !category.parent || category.parent.length === 0);
};

const getMoreItems = async (): Promise<Product[]> =>
  listProducts({ pageSize: DEFAULT_PRODUCT_PAGE_SIZE }, "Failed to load additional storefront products");

const getServiceList = async (): Promise<Service[]> => [];

const getMainCarousel = async (): Promise<MainCarouselItem[]> => [];

const getTopCategories = async (): Promise<Category[]> => {
  const categories = await listCategories("Failed to load storefront top categories");
  return categories.filter((category) => !category.parent || category.parent.length === 0).slice(0, 6);
};

const getBigDiscountList = async (): Promise<Product[]> => {
  const products = await listProducts(
    { sort: "featured", pageSize: DEFAULT_PRODUCT_PAGE_SIZE },
    "Failed to load featured products",
  );
  return products.map(normalizeProductPricing);
};

const getFlashDeals = async (): Promise<Product[]> => {
  const products = await listProducts(
    { sort: "featured", pageSize: DEFAULT_PRODUCT_PAGE_SIZE },
    "Failed to load flash deals",
  );
  return products.map(normalizeProductPricing);
};

const market1Api = {
  getCarList,
  getCarBrands,
  getMoreItems,
  getFlashDeals,
  getMobileList,
  getCategories,
  getOpticsList,
  getServiceList,
  getMobileShops,
  getOpticsShops,
  getMainCarousel,
  getMobileBrands,
  getOpticsBrands,
  getTopCategories,
  getTopRatedBrand,
  getNewArrivalList,
  getBigDiscountList,
  getTopRatedProduct,
};

export default market1Api;
