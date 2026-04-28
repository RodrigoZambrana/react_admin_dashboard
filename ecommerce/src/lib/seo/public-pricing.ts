import type { Money, ProductSummary } from "@/types/storefront";

type MoneyLike =
  | Money
  | {
      amount?: number | null;
      currency?: string | null;
    }
  | number
  | null
  | undefined;

export type PublicPricingSource = {
  currency?: string | null;
  price?: MoneyLike;
  salePrice?: MoneyLike;
  basePrice?: MoneyLike;
};

export type PublicPricing = {
  currency: string;
  basePrice: Money;
  publicPrice: Money;
};

const DEFAULT_CURRENCY = "UYU";

const normalizeCurrency = (value?: string | null): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : undefined;
};

const normalizeAmount = (value: MoneyLike): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const amount = value.amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : undefined;
};

const resolveMoney = (value: MoneyLike, currency: string): Money | undefined => {
  const amount = normalizeAmount(value);
  if (amount === undefined) return undefined;
  const explicitCurrency = normalizeCurrency(
    value && typeof value === "object" && "currency" in value ? value.currency : undefined,
  );
  return {
    amount,
    currency: explicitCurrency ?? currency,
  };
};

export const resolvePublicPricing = (
  source: PublicPricingSource,
  fallbackCurrency = DEFAULT_CURRENCY,
): PublicPricing => {
  const resolvedCurrency =
    normalizeCurrency(source.currency) ||
    normalizeCurrency(source.salePrice && typeof source.salePrice === "object" ? source.salePrice.currency : undefined) ||
    normalizeCurrency(source.price && typeof source.price === "object" ? source.price.currency : undefined) ||
    normalizeCurrency(source.basePrice && typeof source.basePrice === "object" ? source.basePrice.currency : undefined) ||
    fallbackCurrency;

  const publicPrice =
    resolveMoney(source.salePrice, resolvedCurrency) ??
    resolveMoney(source.price, resolvedCurrency) ??
    resolveMoney(source.basePrice, resolvedCurrency) ?? {
      amount: 0,
      currency: resolvedCurrency,
    };

  const basePrice =
    resolveMoney(source.basePrice, resolvedCurrency) ??
    resolveMoney(source.price, resolvedCurrency) ??
    resolveMoney(source.salePrice, resolvedCurrency) ?? {
      amount: publicPrice.amount,
      currency: publicPrice.currency,
    };

  return {
    currency: publicPrice.currency || basePrice.currency || resolvedCurrency,
    basePrice,
    publicPrice,
  };
};

export const resolveProductPublicPricing = (
  product: Pick<ProductSummary, "price" | "salePrice"> & Partial<PublicPricingSource>,
): PublicPricing => resolvePublicPricing(product, product.price?.currency ?? DEFAULT_CURRENCY);

