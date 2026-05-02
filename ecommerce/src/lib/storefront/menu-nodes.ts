import type { CategorySummary } from "@/types/storefront";

export interface StorefrontNavigationNode {
  title: string;
  url?: string;
  extLink?: boolean;
  badge?: string;
  child?: StorefrontNavigationNode[];
}

export interface AccordionMenuNode {
  key: string;
  title: string;
  href?: string;
  icon?: string;
  children?: AccordionMenuNode[];
}

export const buildShopCategoryHref = (slug?: string | null) =>
  slug ? `/shop?category=${encodeURIComponent(slug)}` : "/shop";

export const buildCategoryNavigationNode = (
  category: CategorySummary,
  translate: (value: string) => string,
): StorefrontNavigationNode => {
  const children = (category.children ?? []).map((child) =>
    buildCategoryNavigationNode(child, translate),
  );

  return {
    title: translate(category.name),
    url: buildShopCategoryHref(category.slug),
    child: children.length > 0 ? children : undefined,
  };
};

export const resolveStorefrontNavigationIcon = (item: StorefrontNavigationNode) => {
  const normalizedTitle = item.title.trim().toLowerCase();
  const normalizedUrl = item.url?.toLowerCase() ?? "";

  if (normalizedTitle.includes("home") || normalizedUrl === "/") return "home";
  if (normalizedTitle.includes("store") || normalizedUrl.includes("/shop")) return "bag";
  if (normalizedTitle.includes("multimedia") || normalizedUrl.includes("/multimedia")) return "camera";
  if (normalizedTitle.includes("product") || normalizedTitle.includes("categor")) return "category";
  if (normalizedTitle.includes("contact")) return "customer-service";

  return "menu";
};

export const mapStorefrontNavigationToAccordionNodes = (
  nodes: StorefrontNavigationNode[],
  depth = 0,
): AccordionMenuNode[] =>
  nodes.map((item, index) => ({
    key: `${depth}:${index}:${item.title}:${item.url ?? ""}`,
    title: item.title,
    href: item.url,
    icon: depth === 0 ? resolveStorefrontNavigationIcon(item) : undefined,
    children: item.child ? mapStorefrontNavigationToAccordionNodes(item.child, depth + 1) : undefined,
  }));

export const mapCategorySummariesToAccordionNodes = (
  items: CategorySummary[],
  iconList: string[],
  depth = 0,
): AccordionMenuNode[] =>
  items.map((category, index) => ({
    key: `${depth}:${index}:${category.slug ?? category.id ?? category.name}`,
    title: category.name,
    href: buildShopCategoryHref(category.slug),
    icon: depth === 0 ? iconList[index % iconList.length] ?? "category" : undefined,
    children: category.children?.length
      ? mapCategorySummariesToAccordionNodes(category.children, iconList, depth + 1)
      : undefined,
  }));
