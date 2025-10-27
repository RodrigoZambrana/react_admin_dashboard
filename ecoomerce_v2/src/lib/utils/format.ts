import type { InventoryStatus, Money } from "@/types/storefront";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export const formatMoney = (money: Money, locale = "en-US"): string => {
  const { amount, currency } = money;
  const formatterKey = `${locale}:${currency}`;

  if (!currencyFormatters.has(formatterKey)) {
    currencyFormatters.set(
      formatterKey,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "symbol"
      })
    );
  }

  return currencyFormatters.get(formatterKey)!.format(amount);
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

