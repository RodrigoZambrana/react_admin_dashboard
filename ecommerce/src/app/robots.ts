import type { MetadataRoute } from "next";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { buildStorefrontRobots } from "@/lib/seo/robots";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getStorefrontConfig();
  return buildStorefrontRobots(config);
}
