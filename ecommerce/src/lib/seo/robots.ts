import type { MetadataRoute } from "next";
import type { StorefrontConfig } from "@/types/storefront";
import { resolveAbsoluteUrl } from "./urls";

const DEFAULT_DISALLOWED_PREFIXES = [
  "/account",
  "/checkout",
  "/payment",
  "/review",
  "/cart",
  "/auth",
  "/login",
  "/signup",
  "/search",
  "/products",
  "/products/",
  "/product/search",
  "/api",
  "/vendor",
  "/shops",
  "/mobile-category-nav",
  "/market-1",
  "/checkout-alternative",
];

export const buildStorefrontRobots = (
  config: StorefrontConfig,
): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: "*",
      allow: "/",
      disallow: DEFAULT_DISALLOWED_PREFIXES,
    },
  ],
  sitemap: [resolveAbsoluteUrl("/sitemap.xml", config)],
});
