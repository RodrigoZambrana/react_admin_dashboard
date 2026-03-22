"use client";

import { useMemo } from "react";

import { StorefrontApi } from "@/lib/api/storefront";
import type { CategorySummary } from "@/types/storefront";
import { usePanelResource } from "@/hooks/usePanelResource";

const requestCategories = () => StorefrontApi.listCategories();

export function useStorefrontCategoriesResource() {
  return usePanelResource<CategorySummary[]>({
    cacheKey: "storefront.categories.tree",
    request: requestCategories,
    staleMs: 5 * 60_000,
  });
}

export function useStorefrontCategories(): CategorySummary[] {
  const { data } = useStorefrontCategoriesResource();

  return useMemo(() => data ?? [], [data]);
}
