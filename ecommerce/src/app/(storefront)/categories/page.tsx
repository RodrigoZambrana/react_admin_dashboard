import type { Metadata } from "next";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { flattenCategorySummaries } from "@/lib/storefront/adapters";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import CategoriesPageClient from "./CategoriesPageClient";
import StructuredData from "@/components/seo/StructuredData";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { buildCollectionPageJsonLd } from "@/lib/seo/structured-data";
import { resolveAbsoluteUrl } from "@/lib/seo/urls";

export const revalidate = 180;
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Categorías",
    description: "Explora las categorías disponibles del storefront.",
    canonicalPath: "/categories",
  });
}

export default async function CategoriesPage() {
  const config = await getStorefrontConfig();
  try {
    const categories = await StorefrontApi.listCategories();
    const flattened = flattenCategorySummaries(categories);

    return (
      <>
        <StructuredData
          schemas={[
            buildCollectionPageJsonLd(config, {
              name: "Categorías",
              description: "Explora las categorías disponibles del storefront.",
              url: resolveAbsoluteUrl("/categories", config),
            }),
          ]}
        />
        <CategoriesPageClient total={flattened.length} />
      </>
    );
  } catch (error) {
    const message = isApiError(error)
      ? error.message || "Unable to load categories."
      : "Unexpected error loading categories.";

    return <CategoriesPageClient total={0} errorMessage={message} />;
  }
}
