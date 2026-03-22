import type { CategorySummary, ProductSummary } from "@/types/storefront";

export type SearchCategoryOption = {
  key: string;
  label: string;
  slug?: string;
  depth: number;
  lineage: string[];
  lineageLabels: string[];
};

export const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const buildSearchCategoryOptions = (
  categories: CategorySummary[],
  lineage: string[] = [],
  lineageLabels: string[] = [],
  depth = 0,
): SearchCategoryOption[] =>
  categories.flatMap((category) => {
    const currentLineage = [...lineage, category.slug];
    const currentLineageLabels = [...lineageLabels, category.name];
    const current: SearchCategoryOption = {
      key: `${category.id}:${category.slug}`,
      label: category.name,
      slug: category.slug,
      depth,
      lineage: currentLineage,
      lineageLabels: currentLineageLabels,
    };

    const children = category.children?.length
      ? buildSearchCategoryOptions(category.children, currentLineage, currentLineageLabels, depth + 1)
      : [];

    return [current, ...children];
  });

export const filterSearchCategoryOptions = (
  options: SearchCategoryOption[],
  selectedCategorySlug?: string,
) => {
  if (!selectedCategorySlug) {
    return options.filter((option) => option.slug);
  }

  return options.filter(
    (option) =>
      option.slug &&
      (option.slug === selectedCategorySlug || option.lineage.includes(selectedCategorySlug)),
  );
};

export const findMatchingSearchCategories = (
  options: SearchCategoryOption[],
  query: string,
) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return [];
  }

  return options.filter((option) => {
    const haystack = `${option.label} ${option.slug ?? ""}`;
    return normalizeSearchValue(haystack).includes(normalizedQuery);
  });
};

export const getSearchCategoryContext = (option: SearchCategoryOption) => {
  if (option.lineageLabels.length <= 1) {
    return null;
  }

  return option.lineageLabels.slice(0, -1).join(" / ");
};

export const getProductSearchContext = (product: ProductSummary) => {
  const categories = product.categories?.map((category) => category.name).filter(Boolean) ?? [];
  if (categories.length === 0) {
    return null;
  }

  return categories.join(" / ");
};
