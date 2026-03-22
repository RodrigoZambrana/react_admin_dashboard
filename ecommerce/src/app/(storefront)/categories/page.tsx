import type { Metadata } from "next";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { flattenCategorySummaries } from "@/lib/storefront/adapters";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import CategoriesPageClient from "./CategoriesPageClient";

export const revalidate = 180;
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Categorías",
    description: "Explora las categorías disponibles del storefront."
  });
}

export default async function CategoriesPage() {
  try {
    const categories = await StorefrontApi.listCategories();
    const flattened = flattenCategorySummaries(categories);

    return <CategoriesPageClient total={flattened.length} />;
  } catch (error) {
    const message = isApiError(error)
      ? error.message || "Unable to load categories."
      : "Unexpected error loading categories.";

    return <CategoriesPageClient total={0} errorMessage={message} />;
  }
}
