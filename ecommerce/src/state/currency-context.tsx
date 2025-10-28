"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { normalizeCurrencyCode } from "@/lib/currency/utils";
import type { Money } from "@/types/storefront";

const STORAGE_KEY = "storefront.currency.preference";

export type CurrencySettings = {
  baseCurrency: string;
  enabledCurrencies: string[];
  rates: Record<string, number>;
  generatedAt: string;
};

export type CurrencyContextValue = {
  currency: string;
  baseCurrency: string;
  availableCurrencies: string[];
  isLoading: boolean;
  convertMoney: (money: Money, targetCurrency?: string) => Money;
  formatMoney: (money: Money, targetCurrency?: string, locale?: string) => string;
  setCurrency: (currency: string) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const convertAmount = (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string,
  rates: Record<string, number>
) => {
  if (!Number.isFinite(amount)) return amount;
  const from = normalizeCurrencyCode(fromCurrency) ?? baseCurrency;
  const to = normalizeCurrencyCode(toCurrency) ?? baseCurrency;
  if (from === to) return amount;
  const fromRate = from === baseCurrency ? 1 : rates[from];
  const toRate = to === baseCurrency ? 1 : rates[to];
  if (!fromRate || !toRate) {
    return amount;
  }
  if (fromRate === 0) return amount;
  const converted = (amount * toRate) / fromRate;
  return converted;
};

export const StorefrontCurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CurrencySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window === "undefined") return "UYU";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return normalizeCurrencyCode(stored) ?? "UYU";
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await StorefrontApi.getCurrencySettings();
        if (!active) return;
        const normalizedBase = normalizeCurrencyCode(payload.baseCurrency) ?? "UYU";
        const normalizedRates: Record<string, number> = {};
        Object.entries(payload.rates || {}).forEach(([code, rawRate]) => {
          const normalizedCode = normalizeCurrencyCode(code);
          const normalizedRate = toNumber(rawRate);
          if (normalizedCode && normalizedRate) {
            normalizedRates[normalizedCode] = normalizedRate;
          }
        });
        normalizedRates[normalizedBase] = normalizedRates[normalizedBase] ?? 1;
        const enabled = payload.enabledCurrencies
          .map((code) => normalizeCurrencyCode(code))
          .filter((code): code is string => Boolean(code));
        const normalizedRateCurrencies = Object.keys(normalizedRates);
        const uniqueEnabled = Array.from(new Set([normalizedBase, ...enabled, ...normalizedRateCurrencies]));
        setSettings({
          baseCurrency: normalizedBase,
          enabledCurrencies: uniqueEnabled,
          rates: normalizedRates,
          generatedAt: payload.generatedAt
        });
      } catch (error) {
        if (!active) return;
        console.warn("[currency] Failed to load currency settings", error);
        setSettings({
          baseCurrency: "UYU",
          enabledCurrencies: ["UYU"],
          rates: { UYU: 1 },
          generatedAt: new Date().toISOString()
        });
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const preferred = normalizeCurrencyCode(currency);
    const fallback = settings.baseCurrency;
    const available = new Set(settings.enabledCurrencies);
    available.add(settings.baseCurrency);
    const resolved = preferred && available.has(preferred) ? preferred : fallback;
    if (resolved !== currency) {
      setCurrencyState(resolved);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, resolved);
      }
    }
  }, [currency, settings]);

  const setCurrency = useCallback((next: string) => {
    const normalized = normalizeCurrencyCode(next);
    if (!normalized) return;
    setCurrencyState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    }
  }, []);

  const convertMoney = useCallback(
    (money: Money, targetCurrency?: string): Money => {
      if (!settings) return money;
      const fromCurrency = money.currency ?? settings.baseCurrency;
      const toCurrency = normalizeCurrencyCode(targetCurrency) ?? currency ?? settings.baseCurrency;
      const convertedAmount = convertAmount(money.amount, fromCurrency, toCurrency, settings.baseCurrency, settings.rates);
      return {
        amount: convertedAmount,
        currency: toCurrency,
        formatted: undefined
      };
    },
    [currency, settings]
  );

  const formatMoneyValue = useCallback(
    (money: Money, targetCurrency?: string, locale?: string) => {
      const converted = convertMoney(money, targetCurrency);
      const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: converted.currency,
        currencyDisplay: "symbol"
      });
      return formatter.format(converted.amount);
    },
    [convertMoney]
  );

  const contextValue = useMemo<CurrencyContextValue>(() => {
    const baseCurrency = settings?.baseCurrency ?? "UYU";
    const availableCurrencies = settings?.enabledCurrencies ?? [baseCurrency];
    return {
      currency: normalizeCurrencyCode(currency) ?? baseCurrency,
      baseCurrency,
      availableCurrencies,
      isLoading,
      convertMoney,
      formatMoney: formatMoneyValue,
      setCurrency
    };
  }, [convertMoney, currency, formatMoneyValue, isLoading, setCurrency, settings]);

  return <CurrencyContext.Provider value={contextValue}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextValue => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a StorefrontCurrencyProvider");
  }
  return context;
};

export const useOptionalCurrency = (): CurrencyContextValue | undefined => {
  return useContext(CurrencyContext);
};
