export type AnalyticsPageType = "home" | "listing" | "product" | "cart" | "checkout" | "content" | "search" | "unknown";

export const resolvePageType = (pathname?: string | null): AnalyticsPageType => {
  if (!pathname) {
    return "unknown";
  }

  const normalized = pathname.trim().toLowerCase();

  if (normalized === "/" || normalized === "") return "home";
  if (normalized.startsWith("/shop") || normalized.startsWith("/category") || normalized.startsWith("/search")) {
    return normalized.startsWith("/search") ? "search" : "listing";
  }
  if (normalized.startsWith("/product/")) return "product";
  if (normalized.startsWith("/cart")) return "cart";
  if (normalized.startsWith("/checkout")) return "checkout";
  return "content";
};
