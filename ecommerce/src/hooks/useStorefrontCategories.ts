"use client";

import { useEffect, useState } from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import type { CategorySummary } from "@/types/storefront";

export function useStorefrontCategories(): CategorySummary[] {
  const [categories, setCategories] = useState<CategorySummary[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await StorefrontApi.listCategories();
        if (active && data.length > 0) {
          setCategories(data);
        }
      } catch (error) {
        if (!isApiError(error)) {
          console.warn("[storefront] Failed to load storefront categories.", error);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return categories;
}
