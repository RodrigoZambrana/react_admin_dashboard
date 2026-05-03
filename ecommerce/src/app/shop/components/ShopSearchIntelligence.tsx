"use client";

import { useEffect, useMemo, useRef } from "react";

import type Product from "@models/product.model";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { normalizeSearchValue } from "@/lib/storefront/search-utils";
import { usePathname } from "next/navigation";

type ShopSearchIntelligenceProps = {
  searchTerm?: string;
  total: number;
  products: Product[];
  selectedCategorySlug?: string;
  selectedCategoryLabel?: string;
};

const getNormalizedProductFields = (product: Product) =>
  [
    product.title,
    product.slug,
    product.brand,
    product.variantLabel ?? undefined,
    product.description,
    product.shortDescription,
    product.variantKey ?? undefined,
  ].filter((value): value is string => Boolean(value));

export default function ShopSearchIntelligence({
  searchTerm,
  total,
  products,
  selectedCategorySlug,
  selectedCategoryLabel,
}: ShopSearchIntelligenceProps) {
  const pathname = usePathname();
  const pageType = resolvePageType(pathname);
  const lastTrackedKeyRef = useRef<string | null>(null);

  const trimmedSearchTerm = searchTerm?.trim() ?? "";
  const normalizedQuery = useMemo(
    () => (trimmedSearchTerm ? normalizeSearchValue(trimmedSearchTerm) : ""),
    [trimmedSearchTerm],
  );

  const exactMatchCount = useMemo(() => {
    if (!normalizedQuery) {
      return 0;
    }

    return products.reduce((count, product) => {
      const exactMatch = getNormalizedProductFields(product).some(
        (segment) => normalizeSearchValue(segment) === normalizedQuery,
      );
      return exactMatch ? count + 1 : count;
    }, 0);
  }, [normalizedQuery, products]);

  useEffect(() => {
    if (!trimmedSearchTerm) {
      lastTrackedKeyRef.current = null;
      return;
    }

    const hasResults = total > 0;
    const hasExactResults = exactMatchCount > 0;
    const trackingKey = [
      trimmedSearchTerm,
      total,
      exactMatchCount,
      selectedCategorySlug ?? "",
      selectedCategoryLabel ?? "",
    ].join("|");

    if (lastTrackedKeyRef.current === trackingKey) {
      return;
    }

    lastTrackedKeyRef.current = trackingKey;

    void trackEvent({
      event_name: "search",
      event_category: "navigation",
      tenant_id: env.clientSlug,
      page_type: pageType,
      component_type: "shop_search_results",
      component_id: "shop_search_results_exact",
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        query: trimmedSearchTerm,
        query_normalized: normalizedQuery,
        search_stage: "results",
        search_source: "shop_results",
        result_count: total,
        displayed_count: products.length,
        exact_match_count: exactMatchCount,
        has_results: hasResults,
        has_exact_results: hasExactResults,
        category_slug: selectedCategorySlug ?? null,
        category_label: selectedCategoryLabel ?? null,
      },
      data: {
        query: trimmedSearchTerm,
        query_normalized: normalizedQuery,
        search_stage: "results",
        search_source: "shop_results",
        result_count: total,
        displayed_count: products.length,
        exact_match_count: exactMatchCount,
        has_results: hasResults,
        has_exact_results: hasExactResults,
        category_slug: selectedCategorySlug ?? null,
        category_label: selectedCategoryLabel ?? null,
      },
    });
  }, [
    exactMatchCount,
    normalizedQuery,
    pageType,
    products,
    selectedCategoryLabel,
    selectedCategorySlug,
    total,
    trimmedSearchTerm,
  ]);

  return null;
}
