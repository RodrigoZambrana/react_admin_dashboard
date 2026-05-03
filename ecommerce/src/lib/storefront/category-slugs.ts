export const ALL_CATEGORY_SLUG = "all";

export const isAllCategorySlug = (value?: string | null): boolean => {
  if (!value) {
    return true;
  }

  return value.trim().toLowerCase() === ALL_CATEGORY_SLUG;
};
