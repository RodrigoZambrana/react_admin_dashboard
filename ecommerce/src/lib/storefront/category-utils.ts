import navigations from "@data/navigations";
import type { CategorySummary } from "@/types/storefront";

const extractSlug = (href?: string | null): string | undefined => {
  if (!href) {
    return undefined;
  }
  const trimmed = href.replace(/^\/+/, "");
  const searchPrefix = "product/search/";
  if (trimmed.startsWith(searchPrefix)) {
    return trimmed.slice(searchPrefix.length);
  }
  const categoryPrefix = "category/";
  if (trimmed.startsWith(categoryPrefix)) {
    return trimmed.slice(categoryPrefix.length);
  }
  return trimmed;
};

export const buildFallbackCategorySummaries = (): CategorySummary[] => {
  let nextId = 1;

  return navigations.map((item) => {
    const id = nextId++;
    const slug = extractSlug(item.href) ?? `category-${id}`;

    const children: CategorySummary[] = (item.menuData?.categories ?? []).map((category) => {
      const childId = nextId++;
      const childSlug = extractSlug(category.href) ?? `${slug}-${childId}`;

      return {
        id: childId,
        slug: childSlug,
        name: category.title,
        description: null,
        thumbnail: null,
        productCount: 0,
        parentId: id,
        children: []
      } satisfies CategorySummary;
    });

    return {
      id,
      slug,
      name: item.title,
      description: null,
      thumbnail: null,
      productCount: 0,
      parentId: null,
      children
    } satisfies CategorySummary;
  });
};
