import { FALLBACK_CATEGORY_IMAGE } from "@/lib/storefront/adapters";
import type { ProductSummary } from "@/types/storefront";
import type { StorefrontProductCardProps } from "@component/product-cards/StorefrontProductCard";

export const mapProductSummaryToCardProps = (
  product: ProductSummary
): StorefrontProductCardProps => {
  const unitPrice = product.salePrice?.amount ?? product.price.amount;
  const thumbnail = product.thumbnail?.url ?? FALLBACK_CATEGORY_IMAGE;

  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price: unitPrice,
    imgUrl: thumbnail,
    images: [thumbnail],
    category: product.categories?.[0]?.name ?? null,
    rating: product.rating ?? null,
    reviewCount: product.ratingCount ?? null,
    currencyCode: product.price.currency
  };
};
