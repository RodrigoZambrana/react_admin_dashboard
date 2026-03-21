import axios from "@lib/axios";
import Shop from "@models/shop.model";
import Brand from "@models/Brand.model";
import Product from "@models/product.model";
import Service from "@models/service.model";
import Category from "@models/category.model";
import MainCarouselItem from "@models/market-1.model";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import {
  mapCategorySummaryToCategory,
  mapProductSummaryToProduct,
  FALLBACK_CATEGORY_IMAGE,
  flattenCategorySummaries,
} from "@/lib/storefront/adapters";

const fallbackEnvValue =
  process.env.NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS ??
  process.env.ENABLE_STOREFRONT_FALLBACKS ??
  "false";

const failFastEnvValue =
  process.env.NEXT_PUBLIC_STOREFRONT_FAIL_FAST ??
  process.env.STOREFRONT_FAIL_FAST ??
  "false";

const ALLOW_MOCK_FALLBACKS = fallbackEnvValue !== "false" && fallbackEnvValue !== "0";
const ENFORCE_FAIL_FAST = failFastEnvValue === "true" || failFastEnvValue === "1";

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

type Market1DataModule = typeof import("@/__server__/__db__/market-1/data");

const PRODUCT_FALLBACK_ENDPOINT_MAP: Record<string, string> = {
  "/api/market-1/toprated-product": "top-ratings",
  "/api/market-1/new-arrivals": "new-arrivals",
  "/api/market-1/get-more-items": "more-products",
  "/api/market-1/big-discounts": "big-discounts",
  "/api/market-1/flash-deals": "flash-deals",
  "/api/market-1/mega-deal-products": "mega-deals",
};

const CATEGORY_FALLBACK_ENDPOINT_MAP: Record<string, string> = {
  "/api/market-1/bottom-categories": "categories",
  "/api/market-1/top-categories": "top-categories",
  "/api/market-1/category-grid": "mega-deals",
};

let market1DataPromise: Promise<Market1DataModule> | null = null;
let shopDataPromise: Promise<typeof import("@/__server__/__db__/shop/data")> | null = null;

const loadMarket1Data = async () => {
  if (!market1DataPromise) {
    market1DataPromise = import("@/__server__/__db__/market-1/data");
  }
  return market1DataPromise;
};

const loadMarket1Shops = async () => {
  if (!shopDataPromise) {
    shopDataPromise = import("@/__server__/__db__/shop/data");
  }
  const dataModule = await shopDataPromise;
  return dataModule.default;
};

const toError = (error: unknown, fallbackMessage: string) =>
  error instanceof Error ? error : new Error(fallbackMessage);

const logFallbackWarning = (context: string, error: unknown) => {
  if (ALLOW_MOCK_FALLBACKS) {
    if (isApiError(error)) {
      console.warn(`[storefront] ${context} (status ${error.status}): ${error.message}`);
      return;
    }
    if (error instanceof Error) {
      console.warn(`[storefront] ${context}: ${error.message}`);
      return;
    }
    if (error !== null && error !== undefined) {
      console.warn(`[storefront] ${context}:`, error);
    }
  }
};

const normalizeProductId = (item: any) => {
  const slug = typeof item.slug === "string" && item.slug.length ? item.slug : undefined;
  return String(item.id ?? slug ?? item.name ?? Math.random().toString(36).slice(2));
};

const mapMockProducts = (items: any[]): Product[] => {
  return items.map((item) => {
    const id = normalizeProductId(item);
    const slug = typeof item.slug === "string" && item.slug.length ? item.slug : id;
    const thumbnail =
      item.thumbnail ??
      (Array.isArray(item.images) && item.images.length ? item.images[0] : undefined) ??
      FALLBACK_CATEGORY_IMAGE;
    const images =
      Array.isArray(item.images) && item.images.length
        ? item.images
        : thumbnail
        ? [thumbnail]
        : [];

    return {
      ...item,
      id,
      slug,
      title: item.title ?? item.name ?? "Product",
      price: Number(item.price ?? item.salePrice ?? item.basePrice ?? 0),
      basePrice: typeof item.basePrice === "number" ? item.basePrice : undefined,
      salePrice: typeof item.salePrice === "number" ? item.salePrice : undefined,
      currency: item.currency ?? "USD",
      discount: typeof item.discount === "number" ? item.discount : Number(item.discount ?? 0),
      thumbnail,
      images,
      categories: Array.isArray(item.categories) ? item.categories : [],
      rating: typeof item.rating === "number" ? item.rating : 4,
      ratingCount: typeof item.ratingCount === "number" ? item.ratingCount : undefined,
      reviews: Array.isArray(item.reviews) ? item.reviews : [],
    } as Product;
  });
};

const mapMockCategories = (items: any[]): Category[] =>
  items.map((item) => {
    const id = String(item.id ?? item.slug ?? Math.random().toString(36).slice(2));
    const slug = typeof item.slug === "string" && item.slug.length ? item.slug : id;

    return {
      id,
      name: item.name ?? "Category",
      slug,
      icon: item.icon ?? undefined,
      image:
        typeof item.image === "string" && item.image.length ? item.image : FALLBACK_CATEGORY_IMAGE,
      parent: Array.isArray(item.parent) ? item.parent.map(String) : [],
      description: item.description ?? undefined,
    };
  });

const mapMockBrands = (items: any[]): Brand[] =>
  items.map((item) => {
    const id = String(item.id ?? item.slug ?? Math.random().toString(36).slice(2));
    const slug = typeof item.slug === "string" && item.slug.length ? item.slug : id;

    return {
      id,
      slug,
      name: item.name ?? "Brand",
      type: item.type ?? "",
      image: item.image ?? "",
    };
  });

const loadMockProductsFromEndpoint = async (endpoint: string): Promise<Product[]> => {
  const { products } = await loadMarket1Data();
  const type = PRODUCT_FALLBACK_ENDPOINT_MAP[endpoint];
  const source = type ? products.filter((item) => item?.for?.type === type) : products;
  return mapMockProducts(source);
};

const loadMockProductsByType = async (type: string): Promise<Product[]> => {
  const { products } = await loadMarket1Data();
  const filtered = products.filter((item) => item?.for?.type === type);
  return mapMockProducts(filtered);
};

const loadMockCategoriesFromEndpoint = async (endpoint: string): Promise<Category[]> => {
  const { categories } = await loadMarket1Data();
  const type = CATEGORY_FALLBACK_ENDPOINT_MAP[endpoint];
  const source = type ? categories.filter((item) => item?.for?.type === type) : categories;
  return mapMockCategories(source);
};

const loadMockBrandsByType = async (type: string): Promise<Brand[]> => {
  const { brands } = await loadMarket1Data();
  const filtered = brands.filter((item) => item?.for?.type === type);
  return mapMockBrands(filtered);
};

const loadMockShopsSlice = async (
  start: number,
  end: number,
  thumbnails: string[]
): Promise<Shop[]> => {
  const shops = (await loadMarket1Shops()) as Shop[];
  return shops.slice(start, end).map((item, index) => ({
    ...item,
    thumbnail: thumbnails[index] ?? item.thumbnail,
  })) as unknown as Shop[];
};

const fetchProductsWithFallback = async (
  params: Parameters<typeof StorefrontApi.listProducts>[0],
  fallbackEndpoint: string,
  useLive = true
): Promise<Product[]> => {
  let liveProducts: Product[] = [];

  if (useLive) {
    try {
      const response = await StorefrontApi.listProducts(params);
      liveProducts = response.data.map(mapProductSummaryToProduct);
      if (liveProducts.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return liveProducts;
      }
    } catch (error) {
      if (!ALLOW_MOCK_FALLBACKS) {
        return handleFallbackDisabled<Product[]>(
          "Failed to load storefront products",
          error,
          [],
        );
      }
      logFallbackWarning("Falling back to mock products", error);
    }
  } else if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return liveProducts;
  }

  try {
    const response = await axios.get(fallbackEndpoint);
    if (Array.isArray(response.data) && response.data.length > 0) {
      return mapMockProducts(response.data);
    }
  } catch (error) {
    logFallbackWarning(`Local product fallback for ${fallbackEndpoint}`, error);
  }

  return loadMockProductsFromEndpoint(fallbackEndpoint);
};

const fetchCategoriesWithFallback = async (
  fallbackEndpoint: string,
  useLive = true
): Promise<Category[]> => {
  let liveCategories: Category[] = [];

  if (useLive) {
    try {
      const categories = await StorefrontApi.listCategories();
      const flattened = flattenCategorySummaries(categories);
      liveCategories = flattened.map(mapCategorySummaryToCategory);
      if (liveCategories.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return liveCategories;
      }
    } catch (error) {
      if (!ALLOW_MOCK_FALLBACKS) {
        return handleFallbackDisabled<Category[]>(
          "Failed to load storefront categories",
          error,
          [],
        );
      }
      logFallbackWarning("Falling back to mock categories", error);
    }
  } else if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return liveCategories;
  }

  try {
    const response = await axios.get(fallbackEndpoint);
    if (Array.isArray(response.data) && response.data.length > 0) {
      return mapMockCategories(response.data);
    }
  } catch (error) {
    logFallbackWarning(`Local category fallback for ${fallbackEndpoint}`, error);
  }

  return loadMockCategoriesFromEndpoint(fallbackEndpoint);
};

const getTopRatedProduct = async (): Promise<Product[]> => {
  return fetchProductsWithFallback(
    { sort: "best-sellers", pageSize: 8 },
    "/api/market-1/toprated-product"
  );
};

const getTopRatedBrand = async (): Promise<Brand[]> => {
  try {
    const response = await axios.get("/api/market-1/toprated-brand");
    if (Array.isArray(response.data)) {
      const brands = response.data as Brand[];
      if (brands.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return brands;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Brand[]>("Failed to load top rated brands", error, []);
    }
    logFallbackWarning("Falling back to mock featured brands", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockBrandsByType("featured-brands");
};

const getNewArrivalList = async (): Promise<Product[]> => {
  return fetchProductsWithFallback(
    { sort: "newest", pageSize: 12 },
    "/api/market-1/new-arrivals"
  );
};

const getCarBrands = async (): Promise<Brand[]> => {
  try {
    const response = await axios.get("/api/market-1/car-brand-list");
    if (Array.isArray(response.data)) {
      const brands = response.data as Brand[];
      if (brands.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return brands;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Brand[]>("Failed to load car brands", error, []);
    }
    logFallbackWarning("Falling back to mock car brands", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockBrandsByType("car-brands");
};

const getCarList = async (): Promise<Product[]> => {
  try {
    const response = await axios.get("/api/market-1/car-list");
    if (Array.isArray(response.data)) {
      const products = mapMockProducts(response.data);
      if (products.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return products;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Product[]>("Failed to load car products", error, []);
    }
    logFallbackWarning("Falling back to mock car products", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockProductsByType("cars");
};

const getMobileBrands = async (): Promise<Brand[]> => {
  try {
    const response = await axios.get("/api/market-1/mobile-brand-list");
    if (Array.isArray(response.data)) {
      const brands = response.data as Brand[];
      if (brands.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return brands;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Brand[]>("Failed to load mobile brands", error, []);
    }
    logFallbackWarning("Falling back to mock mobile brands", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockBrandsByType("mobile-brands");
};

const getMobileShops = async (): Promise<Shop[]> => {
  try {
    const response = await axios.get("/api/market-1/mobile-shop-list");
    if (Array.isArray(response.data)) {
      const shops = response.data as Shop[];
      if (shops.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return shops;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Shop[]>("Failed to load mobile shops", error, []);
    }
    logFallbackWarning("Falling back to mock mobile shops", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockShopsSlice(4, 8, ["herman miller", "otobi", "hatil", "steelcase"]);
};

const getMobileList = async (): Promise<Product[]> => {
  try {
    const response = await axios.get("/api/market-1/mobile-list");
    if (Array.isArray(response.data)) {
      const products = mapMockProducts(response.data);
      if (products.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return products;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Product[]>("Failed to load mobile products", error, []);
    }
    logFallbackWarning("Falling back to mock mobile products", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockProductsByType("mobile-phones");
};

const getOpticsBrands = async (): Promise<Brand[]> => {
  try {
    const response = await axios.get("/api/market-1/optics/watch-brands");
    if (Array.isArray(response.data)) {
      const brands = response.data as Brand[];
      if (brands.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return brands;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Brand[]>("Failed to load optics brands", error, []);
    }
    logFallbackWarning("Falling back to mock optics brands", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockBrandsByType("optics-brands");
};

const getOpticsShops = async (): Promise<Shop[]> => {
  try {
    const response = await axios.get("/api/market-1/optics/watch-shops");
    if (Array.isArray(response.data)) {
      const shops = response.data as Shop[];
      if (shops.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return shops;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Shop[]>("Failed to load optics shops", error, []);
    }
    logFallbackWarning("Falling back to mock optics shops", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockShopsSlice(0, 4, ["herman miller", "zeiss", "hatil", "steelcase"]);
};

const getOpticsList = async (): Promise<Product[]> => {
  try {
    const response = await axios.get("/api/market-1/optics-list");
    if (Array.isArray(response.data)) {
      const products = mapMockProducts(response.data);
      if (products.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return products;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Product[]>("Failed to load optics products", error, []);
    }
    logFallbackWarning("Falling back to mock optics products", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  return loadMockProductsByType("optics");
};

const getCategories = async (): Promise<Category[]> => {
  const categories = await fetchCategoriesWithFallback("/api/market-1/bottom-categories");
  return categories.filter((category) => !category.parent || category.parent.length === 0);
};

const getMoreItems = async (): Promise<Product[]> => {
  return fetchProductsWithFallback({ pageSize: 12 }, "/api/market-1/get-more-items");
};

const loadMockServiceList = async (): Promise<Service[]> => {
  const { serviceList } = await loadMarket1Data();
  return serviceList.map((service) => ({
    ...service,
    description: service.description ?? ""
  })) as Service[];
};

const getServiceList = async (): Promise<Service[]> => {
  try {
    const response = await axios.get("/api/market-1/get-service-list");
    const services = response.data;

    if (Array.isArray(services)) {
      if (services.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return services;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<Service[]>("Failed to load service list", error, []);
    }
    logFallbackWarning("Falling back to mock service list", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  console.warn("[storefront] Received empty service list response, using mock data instead.");
  return loadMockServiceList();
};

const loadMockMainCarousel = async (): Promise<MainCarouselItem[]> => {
  const { mainCarouselData } = await loadMarket1Data();
  return mainCarouselData as MainCarouselItem[];
};

const getMainCarousel = async (): Promise<MainCarouselItem[]> => {
  try {
    const response = await axios.get("/api/market-1/main-carousel");
    const items = response.data;

    if (Array.isArray(items)) {
      if (items.length > 0 || !ALLOW_MOCK_FALLBACKS) {
        return items;
      }
    }
  } catch (error) {
    if (!ALLOW_MOCK_FALLBACKS) {
      return handleFallbackDisabled<MainCarouselItem[]>(
        "Failed to load main carousel",
        error,
        [],
      );
    }
    logFallbackWarning("Falling back to mock main carousel data", error);
  }

  if (!ALLOW_MOCK_FALLBACKS) {
    return [];
  }

  console.warn("[storefront] Received empty main carousel response, using mock data instead.");
  return loadMockMainCarousel();
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
      discount,
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
  if (liveProducts.length >= minimum || !ALLOW_MOCK_FALLBACKS) {
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
