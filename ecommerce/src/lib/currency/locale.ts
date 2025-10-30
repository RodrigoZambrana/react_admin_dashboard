const envLocale = process.env.NEXT_PUBLIC_STORE_LOCALE;
const DEFAULT_CURRENCY_LOCALE = envLocale && envLocale.trim().length > 0 ? envLocale.trim() : "en-US";

export const resolveCurrencyLocale = (locale?: string | null) => {
  if (locale && locale.trim().length > 0) {
    return locale.trim();
  }
  return DEFAULT_CURRENCY_LOCALE;
};
