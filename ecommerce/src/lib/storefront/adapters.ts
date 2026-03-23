import type Product from "@models/product.model";
import type Category from "@models/category.model";
import type {
  ProductSummary,
  CategorySummary,
  ProductDetail,
  ProductAttributeType,
  ProductVariantAttribute
} from "@/types/storefront";

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
    mode: product.mode ?? "simple",
    variantLabel: product.variantLabel ?? null,
    configuration: product.configuration ?? null,
    specifications: product.specifications ?? undefined,
    categories:
      product.categories?.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug
      })) ?? []
  };
};

const attributeOrder = (type: ProductAttributeType) => {
  const index = ["COLOR", "SIZE", "MATERIAL"].indexOf(type);
  return index === -1 ? 99 : index;
};

const sortVariantAttributes = (attributes: ProductVariantAttribute[]): ProductVariantAttribute[] =>
  [...attributes].sort((a, b) => attributeOrder(a.attribute) - attributeOrder(b.attribute));

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

  const attributeDefinitions = (product.attributes ?? []).map((attribute) => ({
    ...attribute,
    values: [...attribute.values].sort(
      (a, b) => (a.sortOrder ?? a.id ?? 0) - (b.sortOrder ?? b.id ?? 0)
    )
  }));

  attributeDefinitions.sort((a, b) => attributeOrder(a.type) - attributeOrder(b.type));

  const variantEntries = (product.variants ?? []).map((variant) => {
    const variantPrice = variant.price ?? product.price;
    const variantImages = variant.images?.map((image) => image.url).filter(Boolean) ?? [];
    return {
      id: variant.id,
      key: variant.key,
      label: variant.label ?? undefined,
      sku: variant.sku ?? null,
      price: variantPrice.amount,
      currency: variantPrice.currency,
      inventoryStatus: variant.inventoryStatus ?? product.inventoryStatus ?? "in-stock",
      attributes: sortVariantAttributes(variant.attributes ?? []),
      images: variantImages,
      isActive: variant.isActive !== false,
    };
  });

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
    ratingCount: product.ratingCount ?? undefined,
    mode: product.mode ?? "simple",
    publishedParametricOptions: product.publishedParametricOptions ?? undefined,
    variantAttributes: attributeDefinitions,
    variants: variantEntries,
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
