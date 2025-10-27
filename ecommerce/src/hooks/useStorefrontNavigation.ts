"use client";

import { useMemo } from "react";

import { useStorefrontCategories } from "@/hooks/useStorefrontCategories";
import { buildFallbackCategorySummaries } from "@/lib/storefront/category-utils";
import type { CategorySummary } from "@/types/storefront";
import categoryNavigations from "@data/navigations";
import { useTranslation } from "@/state/i18n-context";

const HOME_PATH = process.env.NEXT_PUBLIC_STOREFRONT_HOME_PATH || "/";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export interface NavigationNode {
  title: string;
  url?: string;
  extLink?: boolean;
  badge?: string;
  child?: NavigationNode[];
}

const buildCategoryNode = (
  category: CategorySummary,
  translate: (value: string) => string
): NavigationNode => {
  const children = (category.children ?? []).map((child) =>
    buildCategoryNode(child, translate)
  );

  return {
    title: translate(category.name),
    url: category.slug ? `/product/search/${encodeURIComponent(category.slug)}` : undefined,
    child: children.length > 0 ? children : undefined
  };
};

export const useStorefrontNavigation = () => {
  const categories = useStorefrontCategories();
  const fallbackCategories = useMemo(() => buildFallbackCategorySummaries(), []);
  const categoriesForMenu = categories.length > 0 ? categories : fallbackCategories;
  const categoryIcons = useMemo(
    () => categoryNavigations.map((item) => item.icon || "category"),
    []
  );
  const homePath = useMemo(() => normalizePath(HOME_PATH), []);
  const t = useTranslation();

  const navItems = useMemo<NavigationNode[]>(() => {
    const productChildren = categoriesForMenu.map((category) => buildCategoryNode(category, t));

    return [
      { title: t("Home"), url: homePath },
      {
        title: t("Products"),
        child: productChildren.length > 0 ? productChildren : undefined,
        url: productChildren.length === 0 ? "/shop" : undefined
      },
      { title: t("Store"), url: "/shop" },
      { title: t("Contact"), url: "/contact" }
    ];
  }, [categoriesForMenu, homePath, t]);

  return {
    homePath,
    navItems,
    categoriesForMenu,
    categoryIcons
  };
};

export type { NavigationNode as StorefrontNavigationNode };
