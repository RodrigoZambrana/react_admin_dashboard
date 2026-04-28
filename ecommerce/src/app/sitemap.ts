import type { MetadataRoute } from "next";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { buildStorefrontSitemap } from "@/lib/seo/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getStorefrontConfig();
  return buildStorefrontSitemap(config);
}
