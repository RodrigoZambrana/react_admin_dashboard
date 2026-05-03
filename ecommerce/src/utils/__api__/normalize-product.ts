import type Product from "models/product.model";

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const normalizeOptionalNumber = (value: unknown): number | undefined => {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

export const normalizeProduct = (product: Product): Product => ({
  ...product,
  brand: normalizeOptionalString(product.brand),
  size: normalizeStringArray(product.size),
  status: normalizeOptionalString(product.status),
  colors: normalizeStringArray(product.colors),
  images: normalizeStringArray(product.images),
  basePrice: normalizeOptionalNumber(product.basePrice),
  salePrice: normalizeOptionalNumber(product.salePrice),
  description: normalizeOptionalString(product.description),
  shortDescription: normalizeOptionalString(product.shortDescription),
  currency: normalizeOptionalString(product.currency),
});

export const normalizeProductList = (products: Product[]): Product[] => products.map(normalizeProduct);
