import { StorefrontApi } from "@/lib/api/storefront";
import { flattenCategorySummaries, FALLBACK_CATEGORY_IMAGE } from "@/lib/storefront/adapters";
import type { CategorySummary } from "@/types/storefront";
import CategoryProductShelfClient from "./CategoryProductShelfClient";
import { mapProductSummaryToCardProps } from "./mapProductSummaryToCard";

export interface CategoryProductShelfProps {
  title: string;
  seeMoreLink?: string;
  defaultCategorySlug?: string;
  includeSlugs?: string[];
  includeDescendantsOf?: string[];
  categoryFilter?: (category: CategorySummary) => boolean;
  categoryLimit?: number;
  pageSize?: number;
  emptyStateText?: string;
}

const normalizeCategoryOptions = (
  categories: CategorySummary[]
): Array<{ slug: string; name: string }> =>
  categories.map((category) => ({ slug: category.slug, name: category.name }));

const ensureCategoryImage = (category: CategorySummary) =>
  category.thumbnail?.url ?? FALLBACK_CATEGORY_IMAGE;

const filterCategories = (
  categories: CategorySummary[],
  props: CategoryProductShelfProps
): CategorySummary[] => {
  const { includeSlugs, includeDescendantsOf, categoryFilter, categoryLimit } = props;

  const slugSet = includeSlugs ? new Set(includeSlugs) : null;
  const descendantPrefixes = includeDescendantsOf ?? [];

  const filtered = categories.filter((category) => {
    if (slugSet && !slugSet.has(category.slug)) {
      return false;
    }

    if (
      descendantPrefixes.length > 0 &&
      !descendantPrefixes.some((prefix) => category.slug.startsWith(prefix))
    ) {
      return false;
    }

    if (categoryFilter && !categoryFilter(category)) {
      return false;
    }

    return true;
  });

  if (categoryLimit && categoryLimit > 0) {
    return filtered.slice(0, categoryLimit);
  }

  return filtered;
};

export default async function CategoryProductShelf(props: CategoryProductShelfProps) {
  const {
    title,
    seeMoreLink,
    defaultCategorySlug,
    pageSize = 9,
    emptyStateText
  } = props;

  const categoriesTree = await StorefrontApi.listCategories();
  const flattened = flattenCategorySummaries(categoriesTree);
  const filteredCategories = filterCategories(flattened, props);

  if (filteredCategories.length === 0) {
    return null;
  }

  const selectedSlug =
    defaultCategorySlug && filteredCategories.some((category) => category.slug === defaultCategorySlug)
      ? defaultCategorySlug
      : filteredCategories[0].slug;

  let initialProducts = [];

  try {
    const response = await StorefrontApi.listProducts({
      categorySlug: selectedSlug,
      pageSize,
      sort: "featured"
    });

    initialProducts = response.data.map(mapProductSummaryToCardProps);
  } catch (error) {
    initialProducts = [];
  }

  const categoriesForClient = normalizeCategoryOptions(filteredCategories);

  return (
    <CategoryProductShelfClient
      title={title}
      categories={categoriesForClient}
      initialCategorySlug={selectedSlug}
      initialProducts={initialProducts}
      seeMoreLink={seeMoreLink}
      fetchPageSize={pageSize}
      emptyStateText={emptyStateText}
    />
  );
}
