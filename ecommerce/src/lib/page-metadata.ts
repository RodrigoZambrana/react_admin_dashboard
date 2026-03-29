import type { Metadata } from "next";

import { getStorefrontConfig } from "@/lib/storefront-config";

type StorefrontPageMetadataOptions = {
  title?: string;
  description?: string;
};

export async function buildStorefrontPageMetadata({
  title,
  description,
}: StorefrontPageMetadataOptions = {}): Promise<Metadata> {
  const config = await getStorefrontConfig();
  const siteName = config.seo?.siteName?.trim() || "Tienda";
  const resolvedTitle = title ? `${title} · ${siteName}` : siteName;

  return {
    title: resolvedTitle,
    description: description ?? config.seo?.defaultDescription ?? "Storefront configurado para el proyecto.",
    authors: [{ name: siteName }],
    keywords: [siteName, "ecommerce", "storefront"],
    verification: config.integrations?.google?.searchConsole?.verificationToken
      ? {
          google: config.integrations.google.searchConsole.verificationToken,
        }
      : undefined,
  };
}
