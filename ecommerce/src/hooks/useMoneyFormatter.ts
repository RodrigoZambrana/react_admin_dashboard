"use client";

import { useCallback, useMemo } from "react";

import { normalizeMoney } from "@/lib/utils/format";
import type { Money } from "@/types/storefront";
import { useCurrency, useOptionalCurrency } from "@/state/currency-context";

type FormatMoneyFn = (money: Money) => string;
type FormatAmountFn = (amount: number, currency?: string) => string;

export type MoneyFormatter = {
  formatMoney: FormatMoneyFn;
  formatAmount: FormatAmountFn;
  baseCurrency: string;
  currency: string;
};

export function useMoneyFormatter(): MoneyFormatter {
  const optionalContext = useOptionalCurrency();
  const enforcedContext = optionalContext ?? useCurrency();
  const baseCurrency = enforcedContext.baseCurrency;
  const activeCurrency = optionalContext?.currency ?? enforcedContext.currency;
  const convertMoneyFn = optionalContext?.convertMoney;
  const formatMoneyFn = optionalContext?.formatMoney;

  const cachedFormatMoney = useCallback<FormatMoneyFn>(
    (money) => {
      const normalized = normalizeMoney(money);
      if (!convertMoneyFn || !formatMoneyFn) {
        const currency = normalized.currency ?? baseCurrency;
        try {
          const formatter = new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            currencyDisplay: "symbol"
          });
          return formatter.format(normalized.amount);
        } catch {
          return `${currency} ${normalized.amount.toFixed(2)}`;
        }
      }
      return formatMoneyFn(convertMoneyFn(normalized));
    },
    [baseCurrency, convertMoneyFn, formatMoneyFn]
  );

  const formatAmount = useCallback<FormatAmountFn>(
    (amount, currency) => {
      const resolved = currency && currency.trim().length === 3 ? currency : baseCurrency;
      if (!convertMoneyFn || !formatMoneyFn) {
        return cachedFormatMoney({ amount, currency: resolved });
      }
      return formatMoneyFn(convertMoneyFn({ amount, currency: resolved }));
    },
    [baseCurrency, cachedFormatMoney, convertMoneyFn, formatMoneyFn]
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
