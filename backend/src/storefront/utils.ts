const NON_ALPHANUMERIC = /[^a-z0-9]+/gi

export const slugify = (input: string): string => {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, '-')
    .replace(/^-+|-+$/g, '')
}

export const buildProductSlug = (id: number, name?: string | null, code?: string | null): string => {
  const base = code?.trim() || name?.trim()
  if (base) {
    const normalized = slugify(base)
    return `${normalized}-${id}`
  }
  return `product-${id}`
}

export const buildCategorySlug = (id: number, name: string): string => {
  const normalized = slugify(name)
  return `${normalized}-${id}`
}
