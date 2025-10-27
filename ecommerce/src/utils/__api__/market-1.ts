import axios from "@lib/axios";
import Shop from "@models/shop.model";
import Brand from "@models/Brand.model";
import Product from "@models/product.model";
import Service from "@models/service.model";
import Category from "@models/category.model";
import MainCarouselItem from "@models/market-1.model";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { mapCategorySummaryToCategory, mapProductSummaryToProduct, FALLBACK_CATEGORY_IMAGE, flattenCategorySummaries } from "@/lib/storefront/adapters";

const fetchProductsWithFallback = async (
  params: Parameters<typeof StorefrontApi.listProducts>[0],
  fallbackEndpoint: string,
  useLive = true
): Promise<Product[]> => {
  if (useLive) {
    try {
      const response = await StorefrontApi.listProducts(params);
      if (response.data.length > 0) {
        return response.data.map(mapProductSummaryToProduct);
      }
    } catch (error) {
      if (isApiError(error)) {
        console.warn(
          `[storefront] Falling back to mock products (status ${error.status}): ${error.message}`
        );
      } else {
        console.warn("[storefront] Falling back to mock products:", error);
      }
    }
  }

  const response = await axios.get(fallbackEndpoint);
  return response.data;
};

const fetchCategoriesWithFallback = async (
  fallbackEndpoint: string,
  useLive = true
): Promise<Category[]> => {
  if (useLive) {
    try {
      const categories = await StorefrontApi.listCategories();
      const flattened = flattenCategorySummaries(categories);
      if (flattened.length > 0) {
        return flattened.map(mapCategorySummaryToCategory);
      }
    } catch (error) {
      if (isApiError(error)) {
        console.warn(
          `[storefront] Falling back to mock categories (status ${error.status}): ${error.message}`
        );
      } else {
        console.warn("[storefront] Falling back to mock categories:", error);
      }
    }
  }

  const response = await axios.get(fallbackEndpoint);
  return response.data;
};

const getTopRatedProduct = async (): Promise<Product[]> => {
  return fetchProductsWithFallback(
    { sort: "best-sellers", pageSize: 8 },
    "/api/market-1/toprated-product"
  );
};

const getTopRatedBrand = async () => {
  const response = await axios.get("/api/market-1/toprated-brand");
  return response.data;
};

const getNewArrivalList = async (): Promise<Product[]> => {
  return fetchProductsWithFallback({ sort: "newest", pageSize: 12 }, "/api/market-1/new-arrivals");
};

const getCarBrands = async (): Promise<Brand[]> => {
  const response = await axios.get("/api/market-1/car-brand-list");
  return response.data;
};

const getCarList = async (): Promise<Product[]> => {
  const response = await axios.get("/api/market-1/car-list");
  return response.data;
};

const getMobileBrands = async (): Promise<Brand[]> => {
  const response = await axios.get("/api/market-1/mobile-brand-list");
  return response.data;
};

const getMobileShops = async (): Promise<Shop[]> => {
  const response = await axios.get("/api/market-1/mobile-shop-list");
  return response.data;
};

const getMobileList = async (): Promise<Product[]> => {
  const response = await axios.get("/api/market-1/mobile-list");
  return response.data;
};

const getOpticsBrands = async (): Promise<Brand[]> => {
  const response = await axios.get("/api/market-1/optics/watch-brands");
  return response.data;
};

const getOpticsShops = async (): Promise<Shop[]> => {
  const response = await axios.get("/api/market-1/optics/watch-shops");
  return response.data;
};

const getOpticsList = async (): Promise<Product[]> => {
  const response = await axios.get("/api/market-1/optics-list");
  return response.data;
};

const getCategories = async (): Promise<Category[]> => {
  const categories = await fetchCategoriesWithFallback("/api/market-1/bottom-categories");
  return categories.filter((category) => !category.parent || category.parent.length === 0);
};

const getMoreItems = async (): Promise<Product[]> => {
  return fetchProductsWithFallback({ pageSize: 12 }, "/api/market-1/get-more-items");
};

const getServiceList = async (): Promise<Service[]> => {
  const response = await axios.get("/api/market-1/get-service-list");
  return response.data;
};

const getMainCarousel = async (): Promise<[MainCarouselItem]> => {
  const response = await axios.get("/api/market-1/main-carousel");
  return response.data;
};

const getTopCategories = async (): Promise<Category[]> => {
  const categories = await fetchCategoriesWithFallback("/api/market-1/top-categories");
  return categories.filter((category) => !category.parent || category.parent.length === 0).slice(0, 6);
};

const BIG_DISCOUNT_MIN_ITEMS = 6;
const FLASH_DEALS_MIN_ITEMS = 4;

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
      discount
    };
  }

  return product;
};

const collectProductsWithMinimum = async (
  params: Parameters<typeof StorefrontApi.listProducts>[0],
  fallbackEndpoint: string,
  minimum: number
): Promise<Product[]> => {
  const liveProducts = await fetchProductsWithFallback(params, fallbackEndpoint);
  if (liveProducts.length >= minimum) {
    return liveProducts;
  }

  const fallbackProducts = await fetchProductsWithFallback(params, fallbackEndpoint, false);
  return mergeProductCollections(liveProducts, fallbackProducts);
};

const mergeProductCollections = (primary: Product[], secondary: Product[]): Product[] => {
  const merged = new Map<string | number, Product>();

  [...primary, ...secondary].forEach((item) => {
    const key = item.slug ?? item.id;
    if (!merged.has(key)) merged.set(key, item);
  });

  return Array.from(merged.values());
};

const getBigDiscountList = async (): Promise<Product[]> => {
  const products = await collectProductsWithMinimum(
    { sort: "featured", pageSize: 12 },
    "/api/market-1/big-discounts",
    BIG_DISCOUNT_MIN_ITEMS
  );

  return products.map(normalizeProductPricing);
};

const getFlashDeals = async (): Promise<Product[]> => {
  const products = await collectProductsWithMinimum(
    { sort: "featured", pageSize: 12 },
    "/api/market-1/flash-deals",
    FLASH_DEALS_MIN_ITEMS
  );

  return products.map(normalizeProductPricing);
};

export default {
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
  getTopRatedProduct
};
