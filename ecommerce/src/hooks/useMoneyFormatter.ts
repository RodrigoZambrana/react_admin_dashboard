"use client";

import { useCallback, useMemo } from "react";

import { normalizeMoney } from "@/lib/utils/format";
import type { Money } from "@/types/storefront";
import { useOptionalCurrency } from "@/state/currency-context";
import { resolveCurrencyLocale } from "@/lib/currency/locale";
import { formatCurrencyAmount } from "@/lib/currency/utils";

type FormatMoneyFn = (money: Money) => string;
type FormatAmountFn = (amount: number, currency?: string) => string;

export type MoneyFormatter = {
  formatMoney: FormatMoneyFn;
  formatAmount: FormatAmountFn;
  baseCurrency: string;
  currency: string;
};

export function useMoneyFormatter(): MoneyFormatter {
  const currencyContext = useOptionalCurrency();
  const baseCurrency = currencyContext?.baseCurrency ?? "UYU";
  const activeCurrency = currencyContext?.currency ?? baseCurrency;
  const convertMoneyFn = currencyContext?.convertMoney;
  const formatMoneyFn = currencyContext?.formatMoney;

  const cachedFormatMoney = useCallback<FormatMoneyFn>(
    (money) => {
      const normalized = normalizeMoney(money);
      if (!convertMoneyFn || !formatMoneyFn) {
        const currency = normalized.currency ?? baseCurrency;
        return formatCurrencyAmount(normalized.amount, currency, resolveCurrencyLocale());
      }
      return formatMoneyFn(convertMoneyFn(normalized));
    },
    [baseCurrency, convertMoneyFn, formatMoneyFn]
  );

  const formatAmount = useCallback<FormatAmountFn>(
    (amount, currency) => {
      const resolved = currency && currency.trim().length === 3 ? currency : baseCurrency;
      if (!convertMoneyFn || !formatMoneyFn) {
        return formatCurrencyAmount(amount, resolved, resolveCurrencyLocale());
      }
      return formatMoneyFn(convertMoneyFn({ amount, currency: resolved }));
    },
    [baseCurrency, convertMoneyFn, formatMoneyFn]
  );

  return useMemo(
    () => ({
      formatMoney: cachedFormatMoney,
      formatAmount,
      baseCurrency,
      currency: activeCurrency
    }),
    [activeCurrency, baseCurrency, cachedFormatMoney, formatAmount]
  );
}
