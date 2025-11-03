const DEFAULT_LOCALE_FALLBACK = "en-US";

const resolveLocale = (explicit?: string) => {
  if (explicit && explicit.trim()) {
    return explicit;
  }
  if (typeof window !== "undefined" && window.navigator?.language) {
    return window.navigator.language;
  }
  return DEFAULT_LOCALE_FALLBACK;
};

const normalizeCurrency = (code?: string | null) => {
  if (!code) {
    return undefined;
  }
  const trimmed = String(code).trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toUpperCase();
};

export function mapCurrencySymbol(code?: string | null): string {
  const normalized = normalizeCurrency(code);
  if (!normalized) {
    return "";
  }
  if (normalized === "USD") {
    return "US$";
  }
  if (normalized === "UYU") {
    return "$";
  }
  return `${normalized} `;
}

type FormatOrderMoneyOptions = {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatOrderMoney(
  amount: number | string | null | undefined,
  currency?: string | null,
  options: FormatOrderMoneyOptions = {}
): string {
  const numeric = Number(amount ?? 0);
  const isFiniteNumber = Number.isFinite(numeric);
  const safeAmount = isFiniteNumber ? numeric : 0;
  const absoluteAmount = Math.abs(safeAmount);
  const locale = resolveLocale(options.locale);
  const minimumFractionDigits = options.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits
  });
  const formatted = formatter.format(absoluteAmount);

  const symbol = mapCurrencySymbol(currency);
  const needsSpace = Boolean(symbol && !symbol.endsWith(" "));
  const signedValue = symbol
    ? `${symbol}${needsSpace ? " " : ""}${formatted}`
    : formatted;

  if (safeAmount < 0 && signedValue) {
    return `-${signedValue}`;
  }

  return signedValue;
}

export function formatOrderMoneyFromMoney(
  money: { amount: number | string; currency?: string | null } | null | undefined,
  options?: FormatOrderMoneyOptions
) {
  if (!money) {
    return formatOrderMoney(0, undefined, options);
  }
  return formatOrderMoney(money.amount, money.currency, options);
}

