import { Fragment } from "react";
import { notFound } from "next/navigation";
import ProductDetailExperience from "@component/products/ProductDetailExperience";
import type Product from "@models/product.model";
import type Shop from "@models/shop.model";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { mapProductDetailToProduct, mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import type { ProductDetail } from "@/types/storefront";

interface ProductPageSearchParams {
  id?: string | string[];
  productId?: string | string[];
}

export const revalidate = 300;

// ==============================================================
const coerceParamToString = (value?: string | string[]): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const firstNonEmpty = value.find((entry) => typeof entry === "string" && entry.trim().length > 0);
    return firstNonEmpty ? firstNonEmpty.trim() : null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const collectProductIdentifiers = (slug: string, searchParams?: ProductPageSearchParams): string[] => {
  const identifiers: string[] = [];
  const addIdentifier = (candidate: string | null | undefined) => {
    if (!candidate) return;
    const normalized = candidate.trim();
    if (!normalized || identifiers.includes(normalized)) return;
    identifiers.push(normalized);
  };

  if (searchParams) {
    addIdentifier(coerceParamToString(searchParams.id));
    addIdentifier(coerceParamToString(searchParams.productId));
  }

  addIdentifier(slug);

  const numericSuffixMatch = slug.match(/(\d+)(?!.*\d)/);
  if (numericSuffixMatch) {
    addIdentifier(numericSuffixMatch[0]);
  }

  return identifiers;
};

export default async function ProductDetails({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductPageSearchParams | undefined>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const { slug } = resolvedParams;
  const identifierCandidates = collectProductIdentifiers(slug, resolvedSearchParams);

  let productDetail: ProductDetail | null = null;
  let product: Product | null = null;
  let relatedProducts: Product[] = [];
  let frequentlyBought: Product[] = [];
  let shops: Shop[] = [];

  for (const identifier of identifierCandidates) {
    try {
      productDetail = await StorefrontApi.getProduct(identifier);
      break;
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        continue;
      }
      console.warn(`[product] Failed to load product using identifier "${identifier}"`, error);
      break;
    }
  }

  if (productDetail) {
    product = mapProductDetailToProduct(productDetail);
    frequentlyBought = Array.isArray(productDetail.frequentlyBoughtTogether)
      ? productDetail.frequentlyBoughtTogether.map(mapProductSummaryToProduct)
      : [];

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
  }

  if (!product) {
    notFound();
  }

  return (
    <Fragment>
      <ProductDetailExperience
        product={product}
        shops={shops}
        relatedProducts={relatedProducts}
        frequentlyBought={frequentlyBought}
        suggestedAddOns={
          Array.isArray(productDetail?.suggestedAddOns)
            ? productDetail.suggestedAddOns.map(mapProductSummaryToProduct)
            : []
        }
        installationAddOn={productDetail?.installationAddOn ?? null}
      />
    </Fragment>
  );
}
