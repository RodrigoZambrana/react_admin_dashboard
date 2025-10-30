import type { InventoryStatus, Money } from "@/types/storefront";
import { formatCurrencyAmount } from "@/lib/currency/utils";
import { resolveCurrencyLocale } from "@/lib/currency/locale";

export const formatMoney = (money: Money, locale = "en-US"): string => {
  const resolvedLocale = resolveCurrencyLocale(locale);
  return formatCurrencyAmount(money.amount, money.currency, resolvedLocale);
};

export const normalizeMoney = (value: Money, locale = "en-US"): Money => ({
  ...value,
  formatted: value.formatted ?? formatMoney(value, locale)
});

export const formatInventoryStatus = (status: InventoryStatus): string => {
  switch (status) {
    case "in-stock":
      return "In stock";
    case "limited":
      return "Low stock";
    case "back-order":
      return "Ships soon";
    case "out-of-stock":
    default:
      return "Out of stock";
  }
};
