"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactElement, ReactNode } from "react";

import {
  DEFAULT_LOCALE,
  INITIAL_LOCALE,
  SUPPORTED_LOCALES,
  TRANSLATIONS,
  type SupportedLocale
} from "@/translations";

type TranslateParams = {
  defaultMessage?: string;
  values?: Record<string, string | number>;
};

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
  toggleLocale: () => void;
  t: (key: string, params?: TranslateParams) => string;
  availableLocales: SupportedLocale[];
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = "storefront.locale.v1";

const isSupportedLocale = (value: string): value is SupportedLocale =>
  SUPPORTED_LOCALES.includes(value as SupportedLocale);

const detectBrowserLocale = (): SupportedLocale | null => {
  if (typeof navigator === "undefined") {
    return null;
  }

  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];

  for (const candidate of candidates) {
    const normalized = candidate?.split("-")[0]?.trim().toLowerCase();
    if (normalized && isSupportedLocale(normalized)) {
      return normalized;
    }
  }

  return null;
};

const normalizeKey = (value: string): string => value.replace(/\s+/g, " ").trim();

const preserveSurroundingWhitespace = (source: string, translated: string): string => {
  const leadingWhitespace = source.match(/^\s+/)?.[0] ?? "";
  const trailingWhitespace = source.match(/\s+$/)?.[0] ?? "";
  return `${leadingWhitespace}${translated}${trailingWhitespace}`;
};

const applyValues = (
  template: string,
  values?: Record<string, string | number>
): string => {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const replacement = values[token];
    return replacement !== undefined ? String(replacement) : match;
  });
};

const lookupTranslation = (
  locale: SupportedLocale,
  key: string
): string | undefined => {
  const dictionary = TRANSLATIONS[locale] ?? {};
  const normalized = normalizeKey(key);
  return dictionary[normalized] ?? dictionary[key];
};

const resolveTranslation = (
  locale: SupportedLocale,
  key: string,
  defaultMessage?: string
): string | undefined => {
  return (
    lookupTranslation(locale, key) ??
    (defaultMessage ? lookupTranslation(locale, defaultMessage) : undefined)
  );
};

export const translateNode = (
  node: ReactNode,
  translate: (value: string) => string
): ReactNode => {
  if (typeof node === "string") {
    return translate(node);
  }
  if (Array.isArray(node)) {
    return Children.toArray(node.map((child) => translateNode(child, translate)));
  }
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (element.props?.children) {
      const translatedChildren = translateNode(element.props.children, translate);
      if (translatedChildren !== element.props.children) {
        return cloneElement(element, element.props, translatedChildren);
      }
    }
  }
  return node;
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(INITIAL_LOCALE);
  const hasBootstrapped = useRef(false);

  const persistLocale = useCallback((value: SupportedLocale) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      console.warn("[i18n] Unable to persist locale preference", error);
    }
  }, []);

  useEffect(() => {
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isSupportedLocale(stored)) {
        setLocaleState(stored);
        return;
      }
    } catch (error) {
      console.warn("[i18n] Unable to read stored locale", error);
    }

    const browserLocale = detectBrowserLocale();
    if (browserLocale) {
      setLocaleState(browserLocale);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      if (!isSupportedLocale(next)) return;
      setLocaleState(next);
      persistLocale(next);
    },
    [persistLocale]
  );

  const toggleLocale = useCallback(() => {
    setLocaleState((current) => {
      const next = current === "es" ? "en" : "es";
      persistLocale(next);
      return next;
    });
  }, [persistLocale]);

  const translate = useCallback(
    (key: string, params?: TranslateParams) => {
      const source = params?.defaultMessage ?? key;
      const candidates: string[] = [key];
      if (params?.defaultMessage && params.defaultMessage !== key) {
        candidates.push(params.defaultMessage);
      }
      candidates.push(source);

      const findMessage = (targetLocale: SupportedLocale): string | undefined => {
        for (const candidate of candidates) {
          const resolved = resolveTranslation(targetLocale, candidate, source);
          if (resolved) return resolved;
        }
        return undefined;
      };

      let message = findMessage(locale);
      if (!message && locale !== DEFAULT_LOCALE) {
        message = findMessage(DEFAULT_LOCALE);
      }
      if (!message && locale !== "en") {
        message = findMessage("en");
      }
      if (!message) {
        message = source;
      }

      const decorated = preserveSurroundingWhitespace(source, message);
      return applyValues(decorated, params?.values);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: translate,
      availableLocales: SUPPORTED_LOCALES
    }),
    [locale, setLocale, toggleLocale, translate]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};

export const useTranslation = () => {
  const { t } = useI18n();
  return t;
};

export const useTranslatedNode = (node: ReactNode): ReactNode => {
  const translate = useTranslation();
  return useMemo(() => translateNode(node, translate), [node, translate]);
};
