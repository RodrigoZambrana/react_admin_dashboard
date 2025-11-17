import enTranslations from "./en";
import esTranslations from "./es";

export type SupportedLocale = "en" | "es";

export type TranslationDictionary = Record<string, string>;

export const TRANSLATIONS: Record<SupportedLocale, TranslationDictionary> = {
  en: enTranslations,
  es: esTranslations
};

export const DEFAULT_LOCALE: SupportedLocale = "es";

export const INITIAL_LOCALE: SupportedLocale = "es";

export const SUPPORTED_LOCALES: SupportedLocale[] = ["es", "en"];
