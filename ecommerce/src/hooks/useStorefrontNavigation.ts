"use client";

import { useMemo } from "react";

import { useStorefrontCategories } from "@/hooks/useStorefrontCategories";
import { useTranslation } from "@/state/i18n-context";
import {
  buildCategoryNavigationNode,
  type StorefrontNavigationNode,
} from "@/lib/storefront/menu-nodes";

const HOME_PATH = process.env.NEXT_PUBLIC_STOREFRONT_HOME_PATH || "/";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const useStorefrontNavigation = () => {
  const categories = useStorefrontCategories();
  const categoriesForMenu = categories;
  const categoryIcons = useMemo(() => categories.map(() => "category"), [categories]);
  const homePath = useMemo(() => normalizePath(HOME_PATH), []);
  const t = useTranslation();

  const navItems = useMemo<StorefrontNavigationNode[]>(() => {
    const categoryChildren = categoriesForMenu.map((category) => buildCategoryNavigationNode(category, t));

    return [
      { title: t("Home"), url: homePath },
      { title: t("Store"), url: "/shop" },
      {
        title: t("Products"),
        child: categoryChildren.length > 0 ? categoryChildren : undefined,
        url: "/shop"
      },
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

export type { StorefrontNavigationNode };
