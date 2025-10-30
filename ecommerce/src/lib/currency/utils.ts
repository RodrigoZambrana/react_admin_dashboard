import {
  CURRENCY_DEFINITIONS,
  DEFAULT_CURRENCIES,
  getCurrencyDefinition,
  getCurrencySymbol
} from "./definitions";
import { resolveCurrencyLocale } from "./locale";

const sanitizeKey = (value: string) => value.replace(/[^A-Z]/g, "");

const buildAliasMap = () => {
  const map = new Map<string, string>();
  const register = (target: string, code: string) => {
    const upper = target.trim().toUpperCase();
    if (!upper) {
      return;
    }
    map.set(upper, code);
    const sanitized = sanitizeKey(upper);
    if (sanitized && sanitized !== upper) {
      map.set(sanitized, code);
    }
  };
  CURRENCY_DEFINITIONS.forEach((definition) => {
    register(definition.code, definition.code);
    if (definition.symbol) {
      register(definition.symbol, definition.code);
    }
    if (definition.narrowSymbol) {
      register(definition.narrowSymbol, definition.code);
    }
    definition.aliases?.forEach((alias) => {
      register(alias, definition.code);
    });
  });
  return map;
};

const currencyAliasMap = buildAliasMap();

const resolveDefinition = (input?: string | null) => {
  if (input === null || input === undefined) {
    return undefined;
  }
  const trimmed = String(input).trim();
  if (!trimmed) {
    return undefined;
  }
  const direct = getCurrencyDefinition(trimmed);
  if (direct) {
    return direct;
  }
  const upper = trimmed.toUpperCase();
  const alias = currencyAliasMap.get(upper);
  if (alias) {
    return getCurrencyDefinition(alias) ?? { code: alias, label: alias, symbol: alias };
  }
  const sanitized = sanitizeKey(upper);
  if (sanitized) {
    const sanitizedAlias = currencyAliasMap.get(sanitized);
    if (sanitizedAlias) {
      return (
        getCurrencyDefinition(sanitizedAlias) ?? {
          code: sanitizedAlias,
          label: sanitizedAlias,
          symbol: sanitizedAlias
        }
      );
    }
    const sanitizedDefinition = getCurrencyDefinition(sanitized);
    if (sanitizedDefinition) {
      return sanitizedDefinition;
    }
  }
  return undefined;
};

export const STANDARD_FALLBACK_CURRENCIES = [...DEFAULT_CURRENCIES];

export function normalizeCurrencyCode(raw?: string | null, fallback?: string): string | undefined {
  const lookup = (input?: string | null): string | undefined => {
    const definition = resolveDefinition(input);
    if (definition) {
      return definition.code;
    }
    if (!input) {
      return undefined;
    }
    const trimmed = String(input).trim();
    if (!trimmed) {
      return undefined;
    }
    const upper = trimmed.toUpperCase();
    if (/^[A-Z]{3,5}$/.test(upper)) {
      return upper;
    }
    const sanitized = sanitizeKey(upper);
    if (sanitized && /^[A-Z]{3,5}$/.test(sanitized)) {
      return sanitized;
    }
    return undefined;
  };

  return lookup(raw) ?? lookup(fallback);
}

export function formatCurrencyOptionLabel(code: string, label?: string, symbol?: string): string {
  const definition = resolveDefinition(code);
  const resolvedLabel = label ?? definition?.label;
  const resolvedSymbol = symbol ?? definition?.symbol;
  const segments: string[] = [code.toUpperCase()];
  if (resolvedLabel) {
    const trimmed = resolvedLabel.trim();
    if (trimmed && trimmed.toUpperCase() !== code.toUpperCase()) {
      segments.push(trimmed);
    }
  }
  const suffix = resolvedSymbol?.trim();
  return suffix ? `${segments.join(" · ")} (${suffix})` : segments.join(" · ");
}

export function getCurrencySymbolSafe(code?: string | null): string | undefined {
  return getCurrencySymbol(code);
}

export function formatCurrencyAmount(
  amount: number,
  currency: string | undefined,
  locale?: string
): string {
  const resolvedCurrency = normalizeCurrencyCode(currency) ?? currency ?? "USD";
  const resolvedLocale = resolveCurrencyLocale(locale);
  const definition = getCurrencyDefinition(resolvedCurrency);
  try {
    const formatter = new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency: resolvedCurrency,
      currencyDisplay: "symbol"
    });
    if (!definition?.symbol) {
      return formatter.format(amount);
    }
    const parts = formatter.formatToParts(amount);
    return parts
      .map((part) => (part.type === "currency" ? definition.symbol : part.value))
      .join("");
  } catch {
    const symbol = definition?.symbol ?? resolvedCurrency;
    return `${symbol} ${Number.isFinite(amount) ? amount.toFixed(2) : amount}`;
  }
}
