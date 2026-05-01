import type { StorefrontProductMediaItem } from "@/types/storefront";

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normalizeMediaSlug = (value: string) => slugify(value.trim());

export const buildMediaSlug = (
  item: Pick<StorefrontProductMediaItem, "type" | "slug" | "name" | "familyKey">,
  index: number,
) => {
  const canonical = item.slug?.trim() || item.familyKey?.trim() || item.name?.trim();
  if (canonical) {
    return normalizeMediaSlug(canonical);
  }
  return `${item.type === "video" ? "video" : "imagen"}_${index + 1}`;
};

export const buildMediaRouteHref = (productSlug: string, mediaSlug: string) =>
  `/multimedia/${encodeURIComponent(productSlug)}/${encodeURIComponent(mediaSlug)}`;
