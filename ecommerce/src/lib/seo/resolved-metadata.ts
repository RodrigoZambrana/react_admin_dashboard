import type { Metadata } from "next";

import type { ResolvedSeoMetadata } from "@/types/storefront";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

const normalizeText = (value?: string | null) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const resolveAbsolute = (value: string, metadataBase?: URL | null) => {
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }
  if (!metadataBase) {
    return value;
  }
  return new URL(value.startsWith("/") ? value : `/${value}`, metadataBase).toString();
};

const parseRobots = (value?: string | null): Metadata["robots"] | undefined => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return {
    index: !normalized.includes("noindex"),
    follow: !normalized.includes("nofollow"),
  };
};

export const buildResolvedSeoMetadata = async (
  document: ResolvedSeoMetadata,
  options?: {
    requestPath?: string;
  },
): Promise<Metadata> => {
  const currentPath = normalizeText(options?.requestPath);
  const preferredPath = normalizeText(document.routePath);
  const shouldNoIndexDuplicate = Boolean(currentPath && preferredPath && currentPath !== preferredPath);
  const robots = shouldNoIndexDuplicate ? "noindex,follow" : document.robots;

  const base = await buildStorefrontPageMetadata({
    title: document.title,
    description: document.description,
    keywords: [...document.keywords, ...document.searchTerms],
    image: document.ogImage ?? null,
    noIndex: robots.toLowerCase().includes("noindex"),
  });
  const baseOther = Object.fromEntries(
    Object.entries(base.other ?? {}).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | Array<string | number>>;
  const baseKeywords = Array.isArray(base.keywords)
    ? base.keywords
    : typeof base.keywords === "string"
      ? [base.keywords]
      : [];
  const resolvedCanonicalUrl = resolveAbsolute(document.canonicalUrl, base.metadataBase);
  const resolvedOgImage = document.ogImage ? resolveAbsolute(document.ogImage, base.metadataBase) : null;

  return {
    ...base,
    title: document.title,
    description: document.description,
    keywords: Array.from(new Set([...baseKeywords, ...document.keywords, ...document.searchTerms])),
    alternates: {
      canonical: resolvedCanonicalUrl,
    },
    robots: parseRobots(robots),
    openGraph: {
      ...base.openGraph,
      title: document.ogTitle ?? document.title,
      description: document.ogDescription ?? document.description,
      url: resolvedCanonicalUrl,
      images: resolvedOgImage
        ? [
            {
              url: resolvedOgImage,
              alt: document.title,
            },
          ]
        : base.openGraph?.images,
    },
    twitter: {
      ...base.twitter,
      title: document.ogTitle ?? document.title,
      description: document.ogDescription ?? document.description,
      images: resolvedOgImage ? [resolvedOgImage] : base.twitter?.images,
    },
    other: {
      ...baseOther,
      "semantic:entity_type": document.entityType,
      "semantic:search_terms": document.searchTerms.join(", "),
      "semantic:materials": document.semantic.materials.join(", "),
      "semantic:dimensions": document.semantic.dimensions.join(", "),
      "semantic:uses": document.semantic.uses.join(", "),
      "semantic:customizations": (document.semantic.customizations ?? []).join(", "),
    },
  };
};
