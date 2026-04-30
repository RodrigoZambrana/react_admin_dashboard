"use client";

import { useMemo } from "react";

import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useStorefrontCategories } from "@/hooks/useStorefrontCategories";
import { useTranslation } from "@/state/i18n-context";
import {
  buildCategoryNavigationNode,
  type StorefrontNavigationNode,
} from "@/lib/storefront/menu-nodes";

const HOME_PATH = process.env.NEXT_PUBLIC_STOREFRONT_HOME_PATH || "/";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

type ConfigNavigationItem = {
  label: string;
  href: string;
  external?: boolean;
  items?: ConfigNavigationItem[];
};

const mapNavigationItems = (
  items: ConfigNavigationItem[],
): StorefrontNavigationNode[] =>
  items
    .map((item) => ({
      title: item.label,
      url: item.href,
      extLink: Boolean(item.external),
      child: Array.isArray(item.items) && item.items.length > 0 ? mapNavigationItems(item.items) : undefined,
    }))
    .filter((item) => item.title);

const dedupeNavigationItems = (items: StorefrontNavigationNode[]): StorefrontNavigationNode[] => {
  const seen = new Set<string>();

  return items
    .map((item) => ({
      ...item,
      child: Array.isArray(item.child) ? dedupeNavigationItems(item.child) : item.child,
    }))
    .filter((item) => {
      const key = `${item.title.trim().toLowerCase()}|${item.url?.trim().toLowerCase() ?? ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

export const useStorefrontNavigation = () => {
  const storefrontConfig = useStorefrontConfig();
  const categories = useStorefrontCategories();
  const categoriesForMenu = categories;
  const categoryIcons = useMemo(() => categories.map(() => "category"), [categories]);
  const homePath = useMemo(() => normalizePath(HOME_PATH), []);
  const t = useTranslation();

  const navItems = useMemo<StorefrontNavigationNode[]>(() => {
    const categoryChildren = categoriesForMenu.map((category) => buildCategoryNavigationNode(category, t));
    const configuredPrimary = mapNavigationItems(storefrontConfig.navigation?.primary ?? []);
    const uniquePrimary = dedupeNavigationItems(configuredPrimary);

    return uniquePrimary.map((item) => {
      const normalizedTitle = item.title.trim().toLowerCase();
      const normalizedUrl = item.url?.trim().toLowerCase() ?? "";
      const isCategoriesNode =
        normalizedUrl === "/categories" ||
        normalizedTitle === "categorías" ||
        normalizedTitle === "categories";

      if (!isCategoriesNode) {
        if (normalizedUrl === "/") {
          return {
            ...item,
            url: homePath,
          };
        }
        return item;
      }

      return {
        ...item,
        url: "/shop",
        child: categoryChildren.length > 0 ? categoryChildren : item.child,
      };
    });
  }, [categoriesForMenu, homePath, storefrontConfig.navigation?.primary, t]);

  return {
    homePath,
    navItems,
    categoriesForMenu,
    categoryIcons
  };
};

export type { StorefrontNavigationNode };
