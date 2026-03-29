"use client";

import { useMemo, useState } from "react";

import ProductIntro from "@component/products/ProductIntro";
import ProductView from "@component/products/ProductView";
import type Product from "@models/product.model";
import type Shop from "@models/shop.model";

type Props = {
  product: Product;
  shops: Shop[];
  relatedProducts: Product[];
  frequentlyBought: Product[];
  suggestedAddOns: Product[];
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
};

export default function ProductDetailExperience({
  product,
  shops,
  relatedProducts,
  frequentlyBought,
  suggestedAddOns,
  installationAddOn
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
        publishedParametricOptions={product.publishedParametricOptions}
        onPublishedParametricVariantChange={setPublishedSelectionState}
        variantAttributes={product.variantAttributes}
        variants={product.variants}
      />

      <ProductView
        shops={shops}
        relatedProducts={relatedProducts}
        frequentlyBought={frequentlyBought}
        suggestedAddOns={suggestedAddOns}
        installationAddOn={installationAddOn}
        description={product.description}
        descriptionHtml={product.descriptionHtml}
        specifications={activeSpecifications}
      />
    </>
  );
}
