"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import BudgetCalculatorPanel from "@/components/budget/BudgetCalculatorPanel";
import ProductIntro from "@component/products/ProductIntro";
import ProductView from "@component/products/ProductView";
import type Product from "@models/product.model";
import type Shop from "@models/shop.model";
import type Review from "@models/Review.model";

type Props = {
  product: Product;
  shops: Shop[];
  relatedProducts: Product[];
  frequentlyBought: Product[];
  suggestedAddOns: Product[];
  beforeDetails?: ReactNode;
  installationAddOn?: {
    id: number;
    name: string;
    productCode?: string | null;
    shortDescription?: string | null;
    price: {
      amount: number;
      currency: string;
      formatted?: string;
    };
  } | null;
  reviews?: Array<{
    id: number;
    rating: number;
    title?: string | null;
    comment: string;
    createdAt: string;
    verifiedPurchase: boolean;
    customer: {
      name: string;
      imgUrl?: string | null;
    };
  }>;
  reviewSummary?: {
    averageRating: number;
    reviewCount: number;
  } | null;
};

export default function ProductDetailExperience({
  product,
  shops,
  relatedProducts,
  frequentlyBought,
  suggestedAddOns,
  beforeDetails,
  installationAddOn,
  reviews,
  reviewSummary
}: Props) {
  const [publishedSelectionState, setPublishedSelectionState] = useState<{
    specifications: Array<{ label: string; value: string }>;
    configuration: Record<string, unknown>;
  } | null>(null);

  const activeSpecifications = useMemo(() => {
    if (publishedSelectionState?.specifications?.length) {
      return publishedSelectionState.specifications;
    }
    return product.specifications;
  }, [product.specifications, publishedSelectionState?.specifications]);

  const productReviews: Review[] | undefined = reviews?.map((review) => ({
    id: String(review.id),
    rating: review.rating,
    comment: review.comment,
    title: review.title ?? undefined,
    date: review.createdAt,
    customer: {
      name: review.customer.name,
      imgUrl: review.customer.imgUrl ?? null,
    },
    verifiedPurchase: review.verifiedPurchase,
    published: true,
  }));

  const budgetEnabled = product.isBudgetCalculable && product.measurementType === "M2";

  return (
    <>
      <ProductIntro
        id={product.id}
        slug={product.slug}
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
        mode={product.mode}
        configuration={product.configuration}
        publishedParametricOptions={product.publishedParametricOptions}
        onPublishedParametricVariantChange={setPublishedSelectionState}
        variantAttributes={product.variantAttributes}
        variants={product.variants}
      />

      {beforeDetails}

      {budgetEnabled ? (
        <BudgetCalculatorPanel
          compact
          tone="product"
          title={`Calculá el precio de ${product.title}`}
          description="Ingresá las medidas y calculá el precio al instante."
          initialProductId={Number(product.id)}
          initialProductSlug={product.slug}
        />
      ) : null}

      <ProductView
        shops={shops}
        relatedProducts={relatedProducts}
        frequentlyBought={frequentlyBought}
        suggestedAddOns={suggestedAddOns}
        installationAddOn={installationAddOn}
        description={product.description}
        descriptionHtml={product.descriptionHtml}
        specifications={activeSpecifications}
        reviews={productReviews}
        reviewSummary={reviewSummary}
      />
    </>
  );
}
