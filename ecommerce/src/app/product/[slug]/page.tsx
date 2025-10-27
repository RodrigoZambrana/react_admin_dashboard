import { Fragment } from "react";
import { notFound } from "next/navigation";
import ProductView from "@component/products/ProductView";
import ProductIntro from "@component/products/ProductIntro";
import api from "@utils/__api__/products";
import type Product from "@models/product.model";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { mapProductDetailToProduct, mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import type { ProductDetail } from "@/types/storefront";

interface ProductPageSearchParams {
  id?: string | string[];
  productId?: string | string[];
}

// ==============================================================
interface Props {
  params: { slug: string };
  searchParams?: ProductPageSearchParams;
}
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

export default async function ProductDetails({ params, searchParams }: Props) {
  const { slug } = params;
  const identifierCandidates = collectProductIdentifiers(slug, searchParams);

  let productDetail: ProductDetail | null = null;
  let product: Product | null = null;
  let relatedProducts: Product[] = [];
  let frequentlyBought: Product[] = [];
  let shops = [];

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

    try {
      const recommendations = await StorefrontApi.getRecommendations(productDetail.id, 8);
      if (recommendations.length > 0) {
        relatedProducts = recommendations.map(mapProductSummaryToProduct);
      }
    } catch (recommendationError) {
      if (!isApiError(recommendationError)) {
        console.warn("[product] Failed to load recommendations, fallback to mock", recommendationError);
      }
    }
  }

  if (!product) {
    console.warn(
      `[product] Falling back to mock product data for slug "${slug}" after storefront lookup failed`
    );

    for (const identifier of identifierCandidates) {
      try {
        product = await api.getProduct(identifier);
        break;
      } catch (mockError) {
        continue;
      }
    }
  }

  if (!product) {
    notFound();
  }

  if (relatedProducts.length === 0) {
    relatedProducts = await api.getRelatedProducts();
  }

  frequentlyBought = await api.getFrequentlyBought();
  shops = await api.getAvailableShop();

  return (
    <Fragment>
      <ProductIntro
        id={product.id}
        price={product.price}
        currency={product.currency}
        basePrice={product.basePrice}
        discount={product.discount}
        rating={product.rating}
        ratingCount={product.ratingCount}
        brand={product.brand}
        status={product.status}
        shortDescription={product.shortDescription}
        title={product.title}
        images={product.images && product.images.length > 0 ? product.images : [product.thumbnail]}
      />

      <ProductView
        shops={shops}
        relatedProducts={relatedProducts}
        frequentlyBought={frequentlyBought}
        description={product.description}
        descriptionHtml={product.descriptionHtml}
        specifications={product.specifications}
      />
    </Fragment>
  );
}
