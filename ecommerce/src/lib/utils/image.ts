const KNOWN_PLACEHOLDER_SEGMENTS = [
  "/assets/images/banners/banner-8.png",
  "/assets/images/products/iphone-xi.png",
  "/assets/images/products/placeholder.png"
];

const normalizeSource = (value?: string | null): string => {
  if (!value) return "";
  return value.trim();
};

export const isMissingProductImage = (value?: string | null): boolean => {
  const normalized = normalizeSource(value);
  if (!normalized) return true;
  return KNOWN_PLACEHOLDER_SEGMENTS.some((segment) => normalized.includes(segment));
};

export const filterValidProductImages = (
  sources: Array<string | null | undefined>
): string[] => {
  const seen = new Set<string>();
  sources.forEach((source) => {
    const normalized = normalizeSource(source);
    if (!normalized) return;
    if (isMissingProductImage(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
  });
  return Array.from(seen);
};
