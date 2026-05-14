import { cache } from "react";
import merge from "lodash/merge";

import { getClientVariantConfig, type StorefrontClientVariantConfig } from "@/clients";
import type { HomeLayoutDefinition, StorefrontConfig } from "@/types/storefront";

import { env } from "./env";
import { StorefrontApi, isApiError } from "./api/storefront";
import { DEFAULT_HOME_LAYOUTS, FALLBACK_LAYOUT_KEY } from "./layouts/homeLayouts";
import { readJsonCache, writeJsonCache } from "./persistent-cache";
import { buildDefaultPublicNavigation } from "./storefront/public-navigation";
import { setSnapshotFallbackEnabled } from "./resilience-flags";

const snapshotFallbackEnvValue =
  process.env.NEXT_PUBLIC_ENABLE_SNAPSHOT_FALLBACKS ??
  process.env.ENABLE_SNAPSHOT_FALLBACKS ??
  process.env.ENABLE_STOREFRONT_FALLBACKS ??
  "false";

const SNAPSHOT_FALLBACKS_ENABLED =
  snapshotFallbackEnvValue !== "false" && snapshotFallbackEnvValue !== "0";

const FALLBACK_CONFIG: StorefrontConfig = {
  defaultLayout: FALLBACK_LAYOUT_KEY,
  layouts: DEFAULT_HOME_LAYOUTS,
  navigation: buildDefaultPublicNavigation(),
  theme: {
    accentColor: "#111827",
    accentContrastColor: "#ffffff",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    mutedTextColor: "#475569",
    borderColor: "#e2e8f0",
    radius: { sm: "0.375rem", md: "0.75rem", lg: "1rem" },
    fonts: {
      heading: "var(--font-sans)",
      body: "var(--font-sans)"
    }
  },
  seo: {
    siteName: "urucortinas",
    defaultTitle: "urucortinas",
    titleTemplate: "%s · urucortinas",
    defaultDescription:
      "Catalogo y experiencia de compra conectados al backend del proyecto.",
    shareImage: {
      id: "storefront-share-image",
      url: "/assets/images/banners/shop-cover.png",
      alt: "urucortinas",
    },
  },
  features: {
    languageSelector: true,
    supportedLocales: ["es", "en"],
    defaultLocale: "es",
    supportLauncher: "webchat",
  },
  companyProfile: {
    legalName: "urucortinas",
    tradeName: "urucortinas",
    taxId: null,
    email: null,
    phone: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    seoDescription: null,
    seoAuthor: null,
    seoImageUrl: null,
    googleSiteVerification: null,
    logo: null
  },
  policies: [],
  announcement: null,
  payments: {
    mercadopago: null
  },
  integrations: {
    google: { enabled: false },
    recaptcha: { enabled: false, siteKey: null }
  },
  resilience: {
    snapshotFallbackEnabled: false
  }
};

let lastConfigErrorSignature: string | null = null;

const STOREFRONT_CONFIG_CACHE_KEY = "storefront-config";

const buildCacheKey = (slug: string) => `${STOREFRONT_CONFIG_CACHE_KEY}:${slug}`;

const buildBaseFallbackConfig = (variant: StorefrontClientVariantConfig): StorefrontConfig =>
  merge({}, FALLBACK_CONFIG, {
    seo: {
      siteName: variant.slug,
      defaultTitle: variant.slug,
      titleTemplate: `%s · ${variant.slug}`,
      shareImage: FALLBACK_CONFIG.seo?.shareImage,
    },
    companyProfile: {
      legalName: variant.displayName,
      tradeName: variant.displayName,
      logo: null,
    },
  }) as StorefrontConfig;

const cloneNavigationItems = <T>(items: T[]): T[] =>
  items.map((item) => {
    if (Array.isArray(item)) {
      return cloneNavigationItems(item) as T;
    }
    if (item && typeof item === "object") {
      return { ...(item as Record<string, unknown>) } as T;
    }
    return item;
  });

const applyNavigationArrayOverrides = (
  merged: StorefrontConfig,
  config: StorefrontConfig,
  clientOverrides: StorefrontClientVariantConfig["configOverrides"] = {}
) => {
  const mergedNavigation = merged.navigation ?? FALLBACK_CONFIG.navigation;
  const overrideNavigation = clientOverrides.navigation;
  const configNavigation = config.navigation;

  if (Array.isArray(configNavigation?.primary)) {
    mergedNavigation.primary = cloneNavigationItems(configNavigation.primary);
  }
  if (Array.isArray(configNavigation?.secondary)) {
    mergedNavigation.secondary = cloneNavigationItems(configNavigation.secondary);
  }
  if (Array.isArray(configNavigation?.footer)) {
    mergedNavigation.footer = cloneNavigationItems(configNavigation.footer);
  }
  if (Array.isArray(configNavigation?.socials)) {
    mergedNavigation.socials = cloneNavigationItems(configNavigation.socials);
  }
  if (Array.isArray(configNavigation?.helpLinks)) {
    mergedNavigation.helpLinks = cloneNavigationItems(configNavigation.helpLinks);
  }

  if (Array.isArray(overrideNavigation?.primary)) {
    mergedNavigation.primary = cloneNavigationItems(
      overrideNavigation.primary as StorefrontConfig["navigation"]["primary"]
    );
  }
  if (Array.isArray(overrideNavigation?.secondary)) {
    mergedNavigation.secondary = cloneNavigationItems(
      overrideNavigation.secondary as NonNullable<StorefrontConfig["navigation"]["secondary"]>
    );
  }
  if (Array.isArray(overrideNavigation?.footer)) {
    mergedNavigation.footer = cloneNavigationItems(
      overrideNavigation.footer as NonNullable<StorefrontConfig["navigation"]["footer"]>
    );
  }
  if (Array.isArray(overrideNavigation?.socials)) {
    mergedNavigation.socials = cloneNavigationItems(
      overrideNavigation.socials as NonNullable<StorefrontConfig["navigation"]["socials"]>
    );
  }
  if (Array.isArray(overrideNavigation?.helpLinks)) {
    mergedNavigation.helpLinks = cloneNavigationItems(
      overrideNavigation.helpLinks as NonNullable<StorefrontConfig["navigation"]["helpLinks"]>
    );
  }

  merged.navigation = mergedNavigation;
};

const mergeConfig = (
  config: StorefrontConfig,
  clientOverrides: StorefrontClientVariantConfig["configOverrides"] = {}
): StorefrontConfig => {
  const merged = merge({}, FALLBACK_CONFIG, config ?? {}, clientOverrides ?? {}) as StorefrontConfig;
  applyNavigationArrayOverrides(merged, config, clientOverrides);
  const layouts = merged.layouts?.length ? merged.layouts : DEFAULT_HOME_LAYOUTS;
  const defaultLayout =
    merged.defaultLayout && layouts.some((layout) => layout.key === merged.defaultLayout)
      ? merged.defaultLayout
      : layouts.find((layout) => layout.isDefault)?.key ?? FALLBACK_LAYOUT_KEY;

  return {
    ...merged,
    layouts,
    defaultLayout
  };
};

export const getStorefrontConfig = cache(async (): Promise<StorefrontConfig> => {
  const variant = getClientVariantConfig(env.clientSlug);
  const cacheKey = buildCacheKey(variant.slug);
  const baseFallbackConfig = buildBaseFallbackConfig(variant);

  try {
    const config = await StorefrontApi.getConfig(variant.slug);
    const merged = mergeConfig(merge({}, baseFallbackConfig, config) as StorefrontConfig, variant.configOverrides);
    await writeJsonCache(cacheKey, merged);
    lastConfigErrorSignature = null;
    setSnapshotFallbackEnabled(merged.resilience?.snapshotFallbackEnabled !== false);
    return merged;
  } catch (error) {
    if (isApiError(error)) {
      const signature = `${variant.slug}:${error.status}:${error.code ?? ""}:${
        error.message ?? ""
      }`;
      if (signature !== lastConfigErrorSignature) {
        console.warn(
          `[storefront] API config unavailable for slug "${variant.slug}" (${error.status}). Using cached configuration when available.`,
          error.message,
        );
        lastConfigErrorSignature = signature;
      }
    } else {
      const signature = `${variant.slug}:unknown:${(error as Error)?.message ?? "unknown"}`;
      if (signature !== lastConfigErrorSignature) {
        console.warn(
          `[storefront] Unexpected error loading config for slug "${variant.slug}". Using cached configuration when available.`,
          error,
        );
        lastConfigErrorSignature = signature;
      }
    }
    if (SNAPSHOT_FALLBACKS_ENABLED) {
      const cached = await readJsonCache<StorefrontConfig>(cacheKey);
      if (cached) {
        console.info(
          `[storefront] Serving cached storefront config snapshot for slug "${variant.slug}" from`,
          cached.storedAt,
        );
        const normalized = mergeConfig(cached.value, variant.configOverrides);
        setSnapshotFallbackEnabled(normalized.resilience?.snapshotFallbackEnabled !== false);
        return normalized;
      }
    }
    console.info(`[storefront] Using minimal fallback configuration for slug "${variant.slug}".`);
    const normalizedFallback = mergeConfig(baseFallbackConfig, variant.configOverrides);
    setSnapshotFallbackEnabled(normalizedFallback.resilience?.snapshotFallbackEnabled !== false);
    return normalizedFallback;
  }
});

export const resolveHomeLayout = async (layoutKey?: string): Promise<HomeLayoutDefinition> => {
  const config = await getStorefrontConfig();
  const targetKey = layoutKey ?? config.defaultLayout ?? FALLBACK_LAYOUT_KEY;
  const layout =
    config.layouts.find((candidate) => candidate.key === targetKey) ??
    DEFAULT_HOME_LAYOUTS.find((candidate) => candidate.key === targetKey);

  if (layout) {
    return layout;
  }

  try {
    return await StorefrontApi.getHomeLayout(targetKey);
  } catch (error) {
    console.warn(`[storefront] Unable to retrieve layout "${targetKey}", using fallback`, error);
    return DEFAULT_HOME_LAYOUTS.find((candidate) => candidate.key === FALLBACK_LAYOUT_KEY)!;
  }
};
