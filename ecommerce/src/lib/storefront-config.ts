import { cache } from "react";

import type { HomeLayoutDefinition, StorefrontConfig } from "@/types/storefront";

import { StorefrontApi, isApiError } from "./api/storefront";
import { DEFAULT_HOME_LAYOUTS, FALLBACK_LAYOUT_KEY } from "./layouts/homeLayouts";

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
  }
};

export const getStorefrontConfig = cache(async (): Promise<StorefrontConfig> => {
  try {
    const config = await StorefrontApi.getConfig();
    const layouts = config.layouts?.length ? config.layouts : DEFAULT_HOME_LAYOUTS;
    const defaultLayout =
      config.defaultLayout && layouts.some((layout) => layout.key === config.defaultLayout)
        ? config.defaultLayout
        : layouts.find((layout) => layout.isDefault)?.key ?? FALLBACK_LAYOUT_KEY;

    return {
      ...FALLBACK_CONFIG,
      ...config,
      layouts,
      defaultLayout
    };
  } catch (error) {
    if (isApiError(error)) {
      console.error(`[storefront] Failed to load config via API (${error.status}):`, error.message);
    } else {
      console.error("[storefront] Failed to load config, falling back to defaults:", error);
    }
    return FALLBACK_CONFIG;
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

