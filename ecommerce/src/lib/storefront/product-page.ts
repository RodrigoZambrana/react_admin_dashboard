import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { mapProductDetailToProduct, mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import type { ProductDetail } from "@/types/storefront";
import type Product from "@models/product.model";

export interface ProductPageSearchParams {
  id?: string | string[];
  productId?: string | string[];
}

export interface LoadProductPageDataOptions {
  cmsPagePath?: string;
}

const coerceParamToString = (value?: string | string[]): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const firstNonEmpty = value.find((entry) => typeof entry === "string" && entry.trim().length > 0);
    return firstNonEmpty ? firstNonEmpty.trim() : null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const buildProductSearchKey = (searchParams?: ProductPageSearchParams) =>
  [coerceParamToString(searchParams?.id) ?? "", coerceParamToString(searchParams?.productId) ?? ""].join("|");

const collectProductIdentifiers = (slug: string, searchParams?: ProductPageSearchParams): string[] => {
  const identifiers: string[] = [];
  const addIdentifier = (candidate: string | null | undefined) => {
    if (!candidate) return;
    const normalized = candidate.trim();
    if (!normalized || identifiers.includes(normalized)) return;
    identifiers.push(normalized);
  };

  addIdentifier(slug);

  if (searchParams) {
    addIdentifier(coerceParamToString(searchParams.id));
    addIdentifier(coerceParamToString(searchParams.productId));
  }

  const numericSuffixMatch = slug.match(/(\d+)(?!.*\d)/);
  if (numericSuffixMatch) {
    addIdentifier(numericSuffixMatch[0]);
  }

  return identifiers;
};

export const loadProductPageData = async (
  slug: string,
  searchKey: string,
  options?: LoadProductPageDataOptions,
) => {
  const [searchId, searchProductId] = searchKey.split("|");
  const searchParams: ProductPageSearchParams | undefined =
    searchId.length || searchProductId.length
      ? {
          id: searchId.length ? searchId : undefined,
          productId: searchProductId.length ? searchProductId : undefined,
        }
      : undefined;
  const identifierCandidates = collectProductIdentifiers(slug, searchParams);

  let productDetail: ProductDetail | null = null;

  for (const identifier of identifierCandidates) {
    try {
      productDetail = await StorefrontApi.getProduct(identifier, slug);
      break;
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        continue;
      }
      console.warn(`[product] Failed to load product using identifier "${identifier}"`, error);
      break;
    }
  }

  if (!productDetail) {
    return null;
  }

  const product = mapProductDetailToProduct(productDetail);
  const frequentlyBought = Array.isArray(productDetail.frequentlyBoughtTogether)
    ? productDetail.frequentlyBoughtTogether.map(mapProductSummaryToProduct)
    : [];

  let relatedProducts: Product[] = [];
  try {
    const recommendations = await StorefrontApi.getRecommendations(productDetail.id, 8);
    if (recommendations.length > 0) {
      relatedProducts = recommendations.map(mapProductSummaryToProduct);
    }
  } catch (recommendationError) {
    if (!isApiError(recommendationError)) {
      console.warn("[product] Failed to load recommendations.", recommendationError);
    }
  }

  if (Array.isArray(productDetail.relatedProducts) && productDetail.relatedProducts.length > 0) {
    relatedProducts = productDetail.relatedProducts.map(mapProductSummaryToProduct);
  }

  const [storefrontConfig, cmsPage] = await Promise.all([
    getStorefrontConfig(),
    StorefrontApi.getCmsPage(options?.cmsPagePath ?? `product/${slug}`).catch(() => null),
  ]);

  return {
    productDetail,
    product,
    relatedProducts,
    frequentlyBought,
    storefrontConfig,
    cmsPage,
  };
};

export const buildProductPageMetadata = async (
  slug: string,
  productData: Awaited<ReturnType<typeof loadProductPageData>>,
  options?: { canonicalPath?: string },
) => {
  if (!productData) {
    return null;
  }
  const { buildProductMetadata } = await import("@/lib/page-metadata");
  return buildProductMetadata(productData.productDetail, slug, options?.canonicalPath);
};
