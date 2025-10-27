import type Product from "@models/product.model";
import type Category from "@models/category.model";
import type { ProductSummary, CategorySummary, ProductDetail } from "@/types/storefront";

export const FALLBACK_CATEGORY_IMAGE = "/assets/images/banners/banner-8.png";

const ensureImageList = (images: Array<string | undefined | null>): string[] => {
  const filtered = images.filter((src): src is string => Boolean(src));
  if (filtered.length === 0) {
    return [FALLBACK_CATEGORY_IMAGE];
  }
  return filtered;
};

export const mapProductSummaryToProduct = (product: ProductSummary): Product => {
  const basePrice = product.price.amount;
  const salePrice = product.salePrice?.amount ?? basePrice;
  const discount =
    product.salePrice && product.salePrice.amount < basePrice
      ? Math.max(0, Math.round(((basePrice - product.salePrice.amount) / basePrice) * 100))
      : 0;

  const thumbnail = product.thumbnail?.url ?? FALLBACK_CATEGORY_IMAGE;

  const currencyCode = product.salePrice?.currency ?? product.price.currency;

  return {
    id: String(product.id),
    slug: product.slug,
    title: product.name,
    price: salePrice,
    rating: product.rating ?? 4,
    discount,
    thumbnail,
    images: ensureImageList([thumbnail]),
    currency: currencyCode,
    basePrice,
    salePrice,
    ratingCount: product.ratingCount ?? undefined,
    status: product.inventoryStatus,
    categories:
      product.categories?.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug
      })) ?? []
  };
};

export const mapProductDetailToProduct = (product: ProductDetail): Product => {
  const basePrice = product.price.amount;
  const salePrice = product.salePrice?.amount ?? basePrice;
  const discount =
    product.salePrice && product.salePrice.amount < basePrice
      ? Math.max(0, Math.round(((basePrice - product.salePrice.amount) / basePrice) * 100))
      : 0;

  const galleryImages = product.gallery?.map((image) => image.url) ?? [];
  const thumbnail = product.thumbnail?.url ?? galleryImages[0] ?? FALLBACK_CATEGORY_IMAGE;

  const currencyCode = product.salePrice?.currency ?? product.price.currency;

  return {
    id: String(product.id),
    slug: product.slug,
    title: product.name,
    price: salePrice,
    rating: product.rating ?? 4,
    discount,
    thumbnail,
    images: ensureImageList([thumbnail, ...galleryImages]),
    categories:
      product.categories?.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug
      })) ?? [],
    description: product.description ?? product.shortDescription ?? "",
    shortDescription: product.shortDescription ?? "",
    descriptionHtml: product.descriptionHtml ?? undefined,
    specifications: product.specifications ?? undefined,
    reviews: [],
    status: product.inventoryStatus,
    brand: product.meta?.materials ?? undefined,
    currency: currencyCode,
    basePrice,
    salePrice,
    ratingCount: product.ratingCount ?? undefined
  };
};

export const mapCategorySummaryToCategory = (category: CategorySummary): Category => ({
  id: String(category.id),
  name: category.name,
  slug: category.slug,
  parent: category.parentId ? [String(category.parentId)] : [],
  description: category.description ?? "",
  image: category.thumbnail?.url ?? FALLBACK_CATEGORY_IMAGE
});

export const flattenCategorySummaries = (categories: CategorySummary[]): CategorySummary[] => {
  const flattened: CategorySummary[] = [];

  const visit = (nodes: CategorySummary[]) => {
    nodes.forEach((node) => {
      flattened.push(node);
      if (node.children && node.children.length > 0) {
        visit(node.children);
      }
    });
  };

  visit(categories);
  return flattened;
};
