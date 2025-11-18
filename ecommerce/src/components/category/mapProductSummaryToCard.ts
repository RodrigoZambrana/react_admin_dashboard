import type { ProductSummary } from "@/types/storefront";
import type { StorefrontProductCardProps } from "@component/product-cards/StorefrontProductCard";
import { filterValidProductImages, isMissingProductImage } from "@/lib/utils/image";

export const mapProductSummaryToCardProps = (
  product: ProductSummary
): StorefrontProductCardProps => {
  const normalizeConfiguration = (value: unknown): Record<string, unknown> | null => {
    if (!value) return null;
    if (typeof value === "object") {
      return value as Record<string, unknown>;
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, unknown>;
        }
      } catch (error) {
        console.warn("[products] Failed to parse configuration from product summary", error);
      }
    }
    return null;
  };

  const unitPrice = product.salePrice?.amount ?? product.price.amount;
  const thumbnail = product.thumbnail?.url ?? null;
  const gallery = filterValidProductImages([
    product.thumbnail?.url ?? null,
    ...(product.images?.map((image) => image.url ?? null) ?? []),
    ...(product.gallery?.map((image) => image.url ?? null) ?? [])
  ]);
  const configuration = normalizeConfiguration(
    (product as { configuration?: unknown }).configuration ??
      (product as { parametricConfiguration?: unknown }).parametricConfiguration ??
      (product as { config?: unknown }).config
  );

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
    currencyCode: product.price.currency,
    inventoryStatus: product.inventoryStatus,
    mode: product.mode,
    attributes: product.attributes,
    variantId: product.variantId ?? null,
    variantKey: product.variantKey ?? null,
    variantLabel: product.variantLabel ?? null,
    configuration
  };
};
