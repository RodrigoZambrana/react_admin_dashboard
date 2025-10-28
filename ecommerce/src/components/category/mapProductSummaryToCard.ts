import type { ProductSummary } from "@/types/storefront";
import type { StorefrontProductCardProps } from "@component/product-cards/StorefrontProductCard";
import { filterValidProductImages, isMissingProductImage } from "@/lib/utils/image";

export const mapProductSummaryToCardProps = (
  product: ProductSummary
): StorefrontProductCardProps => {
  const unitPrice = product.salePrice?.amount ?? product.price.amount;
  const thumbnail = product.thumbnail?.url ?? null;
  const gallery = filterValidProductImages([
    product.thumbnail?.url ?? null,
    ...(product.gallery?.map((image) => image.url ?? null) ?? [])
  ]);

  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price: unitPrice,
    imgUrl: thumbnail && !isMissingProductImage(thumbnail) ? thumbnail : undefined,
    images: gallery,
    category: product.categories?.[0]?.name ?? null,
    rating: product.rating ?? null,
    reviewCount: product.ratingCount ?? null,
    currencyCode: product.price.currency
  };
};
