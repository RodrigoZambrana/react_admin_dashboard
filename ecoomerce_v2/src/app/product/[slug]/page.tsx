import { Fragment } from "react";
import ProductView from "@component/products/ProductView";
import ProductIntro from "@component/products/ProductIntro";
import api from "@utils/__api__/products";
import type Product from "@models/product.model";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { mapProductDetailToProduct, mapProductSummaryToProduct } from "@/lib/storefront/adapters";

// ==============================================================
interface Props {
  params: Promise<{ slug: string }>;
}
// ==============================================================

export default async function ProductDetails({ params }: Props) {
  const { slug } = await params;

  let product: Product | null = null;
  let relatedProducts: Product[] = [];
  let frequentlyBought: Product[] = [];
  let shops = [];

  try {
    const detail = await StorefrontApi.getProduct(slug);
    product = mapProductDetailToProduct(detail);

    try {
      const recommendations = await StorefrontApi.getRecommendations(detail.id, 8);
      if (recommendations.length > 0) {
        relatedProducts = recommendations.map(mapProductSummaryToProduct);
      }
    } catch (recommendationError) {
      if (!isApiError(recommendationError)) {
        console.warn("[product] Failed to load recommendations, fallback to mock", recommendationError);
      }
    }
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      // continue to fallback below
    } else {
      console.warn("[product] Falling back to mock product data", error);
    }
  }

  if (!product) {
    const mockProduct = await api.getProduct(slug);
    product = mockProduct;
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
