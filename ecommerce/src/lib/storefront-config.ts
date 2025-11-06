import { cache } from "react";
import merge from "lodash/merge";

import { getClientVariantConfig, type StorefrontClientVariantConfig } from "@/clients";
import type { HomeLayoutDefinition, StorefrontConfig } from "@/types/storefront";

import { env } from "./env";
import { StorefrontApi, isApiError } from "./api/storefront";
import { DEFAULT_HOME_LAYOUTS, FALLBACK_LAYOUT_KEY } from "./layouts/homeLayouts";
import { readJsonCache, writeJsonCache } from "./persistent-cache";
import { setSnapshotFallbackEnabled } from "./resilience-flags";

const FALLBACK_CONFIG: StorefrontConfig = {
  defaultLayout: FALLBACK_LAYOUT_KEY,
  layouts: DEFAULT_HOME_LAYOUTS,
  navigation: {
    primary: [
      { id: "nav-new", label: "New arrivals", href: "/products?sort=newest" },
      { id: "nav-shop", label: "Shop", href: "/products" },
      { id: "nav-categories", label: "Categories", href: "/categories" },
      { id: "nav-stories", label: "Stories", href: "/blog" }
    ],
    secondary: [
      { id: "nav-account", label: "Account", href: "/account" },
      { id: "nav-orders", label: "Order tracking", href: "/account/orders" }
    ],
    footer: [
      [
        { id: "footer-about", label: "About us", href: "/about" },
        { id: "footer-contact", label: "Contact", href: "/contact" },
        { id: "footer-faq", label: "FAQ", href: "/faq" }
      ],
      [
        { id: "footer-shipping", label: "Shipping", href: "/policies/shipping" },
        { id: "footer-returns", label: "Returns", href: "/policies/returns" },
        { id: "footer-privacy", label: "Privacy policy", href: "/policies/privacy" }
      ]
    ],
    socials: [
      { id: "social-instagram", label: "Instagram", href: "https://instagram.com", external: true },
      { id: "social-pinterest", label: "Pinterest", href: "https://pinterest.com", external: true },
      { id: "social-youtube", label: "YouTube", href: "https://youtube.com", external: true }
    ]
  },
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
    siteName: "Ecommerce Storefront",
    defaultTitle: "Ecommerce Storefront",
    titleTemplate: "%s · Ecommerce Storefront",
    defaultDescription:
      "Configurable eCommerce experience powered by a headless backend and Bonik presentation layer."
  },
  companyProfile: {
    legalName: "Bonik Storefront",
    tradeName: "Bonik",
    email: "support@ui-lib.com",
    phone: "+88012 3456 7894",
    addressLine1: "70 Washington Square South, New York, NY 10012, United States",
    logo: "/assets/images/logo.svg"
  },
  policies: [
    {
      title: "Shipping & delivery",
      body: "We ship worldwide within 3-5 business days.",
      updatedAt: new Date().toISOString()
    },
    {
      title: "Returns",
      body: "Returns accepted within 30 days in original condition.",
      updatedAt: new Date().toISOString()
    }
  ],
  announcement: {
    id: "free-shipping",
    message: "Enjoy complimentary express shipping on orders over $150.",
    level: "info",
    active: true,
    cta: { id: "announcement-learn-more", label: "See details", href: "/policies/shipping" }
  },
  payments: {
    mercadopago: null
  },
  integrations: {
    google: { enabled: false },
    recaptcha: { enabled: false, siteKey: null }
  },
  resilience: {
    snapshotFallbackEnabled: true
  }
};

let lastConfigErrorSignature: string | null = null;

const STOREFRONT_CONFIG_CACHE_KEY = "storefront-config";

const buildCacheKey = (slug: string) => `${STOREFRONT_CONFIG_CACHE_KEY}:${slug}`;

const mergeConfig = (
  config: StorefrontConfig,
  clientOverrides: StorefrontClientVariantConfig["configOverrides"] = {}
): StorefrontConfig => {
  const merged = merge({}, FALLBACK_CONFIG, config ?? {}, clientOverrides ?? {}) as StorefrontConfig;
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

  try {
    const config = await StorefrontApi.getConfig(variant.slug);
    const merged = mergeConfig(config, variant.configOverrides);
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
    console.info(
      `[storefront] No cached config available for slug "${variant.slug}". Falling back to defaults.`,
    );
    const normalizedFallback = mergeConfig(FALLBACK_CONFIG, variant.configOverrides);
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
