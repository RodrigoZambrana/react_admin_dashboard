import type { Metadata } from "next";

import { getStorefrontConfig } from "@/lib/storefront-config";
import type { CategorySummary, CmsRenderablePage, ProductDetail } from "@/types/storefront";

type MetadataImageInput = string | { url?: string | null; alt?: string | null } | null;

type StorefrontMetadataOptions = {
  title?: string;
  description?: string;
  keywords?: Array<string | null | undefined>;
  canonicalPath?: string;
  image?: MetadataImageInput;
  noIndex?: boolean;
  openGraphType?: "website" | "article";
};

const DEFAULT_KEYWORDS = ["ecommerce", "storefront"];

const normalizeText = (value?: string | null) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

const normalizePath = (path?: string | null) => {
  const value = normalizeText(path);
  if (!value) return undefined;
  if (value === "/") return "/";
  return value.startsWith("/") ? value : `/${value}`;
};

const resolveImage = (
  image: MetadataImageInput | undefined,
  metadataBase?: URL,
): { url: string; alt?: string } | undefined => {
  if (!image) return undefined;
  if (typeof image === "string") {
    const url = normalizeText(image);
    if (!url) return undefined;
    if (metadataBase) {
      return { url: new URL(url, metadataBase).toString() };
    }
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")
      ? { url }
      : undefined;
  }

  const url = normalizeText(image.url);
  if (!url) return undefined;
  const resolvedUrl = metadataBase
    ? new URL(url, metadataBase).toString()
    : url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")
      ? url
      : undefined;

  if (!resolvedUrl) return undefined;
  const alt = normalizeText(image.alt);
  return alt ? { url: resolvedUrl, alt } : { url: resolvedUrl };
};

const resolveMetadataBase = (website?: string | null) => {
  const normalizedWebsite = normalizeText(website);
  if (!normalizedWebsite) return undefined;

  const candidate = normalizedWebsite.match(/^https?:\/\//i)
    ? normalizedWebsite
    : `https://${normalizedWebsite}`;

  try {
    return new URL(candidate);
  } catch {
    return undefined;
  }
};

const buildMetadata = async ({
  title,
  description,
  keywords,
  canonicalPath,
  image,
  noIndex,
  openGraphType = "website",
}: StorefrontMetadataOptions = {}): Promise<Metadata> => {
  const config = await getStorefrontConfig();
  const companyProfile = config.companyProfile ?? null;
  const companyName =
    normalizeText(companyProfile?.tradeName) ||
    normalizeText(companyProfile?.legalName) ||
    undefined;
  const siteName =
    normalizeText(config.seo?.siteName) ||
    companyName ||
    "Storefront";
  const defaultTitle =
    normalizeText(config.seo?.defaultTitle) ||
    companyName ||
    siteName;
  const titleTemplate = normalizeText(config.seo?.titleTemplate) || `%s · ${siteName}`;
  const normalizedTitle = normalizeText(title);
  const compactTitle = normalizedTitle.replace(/\s+/g, "").toLowerCase();
  const compactSiteName = siteName.replace(/\s+/g, "").toLowerCase();
  const compactDefaultTitle = defaultTitle.replace(/\s+/g, "").toLowerCase();
  const shouldSuffixSiteName =
    Boolean(normalizedTitle) &&
    ![siteName, defaultTitle].some(
      (candidate) => candidate && normalizedTitle.toLowerCase().includes(candidate.toLowerCase()),
    );
  const titleMatchesBrand =
    compactTitle.length > 0 &&
    (compactTitle === compactSiteName || compactTitle === compactDefaultTitle);
  const resolvedTitle = normalizedTitle
    ? shouldSuffixSiteName
      ? titleTemplate.replace("%s", normalizedTitle)
      : titleMatchesBrand
        ? siteName
        : normalizedTitle
    : defaultTitle;
  const resolvedDescription =
    normalizeText(description) ||
    normalizeText(companyProfile?.seoDescription) ||
    normalizeText(config.seo?.defaultDescription) ||
    undefined;
  const metadataBase = resolveMetadataBase(config.companyProfile?.website);
  const resolvedImage =
    resolveImage(image, metadataBase) ??
    resolveImage(companyProfile?.seoImageUrl ?? null, metadataBase) ??
    resolveImage(config.seo?.shareImage ?? null, metadataBase);
  const resolvedAuthor = normalizeText(companyProfile?.seoAuthor) || companyName || siteName;
  const resolvedCanonicalPath = normalizePath(canonicalPath);
  const resolvedKeywords = uniqueStrings([
    siteName,
    defaultTitle,
    ...DEFAULT_KEYWORDS,
    ...(Array.isArray(keywords) ? keywords : []),
  ]);

  return {
    metadataBase,
    title: resolvedTitle,
    description: resolvedDescription,
    authors: [{ name: resolvedAuthor }],
    keywords: resolvedKeywords.length > 0 ? resolvedKeywords : undefined,
    alternates: resolvedCanonicalPath ? { canonical: resolvedCanonicalPath } : undefined,
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      siteName,
      type: openGraphType as any,
      url: resolvedCanonicalPath,
      images: resolvedImage
        ? [
            {
              url: resolvedImage.url,
              alt: resolvedImage.alt ?? resolvedTitle,
            },
          ]
        : undefined,
    },
    twitter: {
      card: resolvedImage ? "summary_large_image" : "summary",
      title: resolvedTitle,
      description: resolvedDescription,
      images: resolvedImage ? [resolvedImage.url] : undefined,
    },
    verification: companyProfile?.googleSiteVerification ||
      config.integrations?.google?.searchConsole?.verificationToken
      ? {
          google:
            companyProfile?.googleSiteVerification ||
            config.integrations?.google?.searchConsole?.verificationToken,
        }
      : undefined,
  };
};

export async function buildStorefrontPageMetadata(
  options: StorefrontMetadataOptions = {},
): Promise<Metadata> {
  return buildMetadata(options);
}

export async function buildProductMetadata(
  product: Pick<
    ProductDetail,
    | "name"
    | "shortDescription"
    | "description"
    | "descriptionHtml"
    | "slug"
    | "thumbnail"
    | "gallery"
    | "tags"
    | "categories"
    | "mode"
    | "canonicalConfiguration"
  > & {
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoImageUrl?: string | null;
  },
  canonicalSlug?: string,
  canonicalPath?: string,
): Promise<Metadata> {
  const description =
    normalizeText(product.seoDescription) ||
    normalizeText(product.shortDescription) ||
    normalizeText(product.description) ||
    normalizeText(product.descriptionHtml?.replace(/<[^>]*>/g, " ")) ||
    undefined;
  const image =
    product.seoImageUrl ??
    product.thumbnail ??
    product.gallery?.[0] ??
    null;

  return buildMetadata({
    title: normalizeText(product.seoTitle) || product.name,
    description,
    keywords: [
      product.name,
      ...(Array.isArray(product.categories)
        ? product.categories.map((category) => category.name)
        : []),
      ...(Array.isArray(product.tags) ? product.tags : []),
      product.mode ?? null,
      product.canonicalConfiguration?.canonicalName ?? null,
      ...(Array.isArray(product.canonicalConfiguration?.searchTerms)
        ? product.canonicalConfiguration.searchTerms
        : []),
    ],
    image,
    canonicalPath: canonicalPath ?? `/product/${canonicalSlug || product.slug}`,
    openGraphType: "website",
  });
}

export async function buildCategoryMetadata(
  category: Pick<CategorySummary, "name" | "slug" | "description" | "thumbnail"> & {
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoImageUrl?: string | null;
  },
  canonicalPath?: string,
): Promise<Metadata> {
  return buildMetadata({
    title: normalizeText(category.seoTitle) || category.name,
    description: normalizeText(category.seoDescription) || normalizeText(category.description) || undefined,
    image: category.seoImageUrl ?? category.thumbnail ?? null,
    keywords: [category.name, category.slug],
    canonicalPath: canonicalPath ?? `/categories/${category.slug}`,
  });
}

export async function buildCmsPageMetadata(
  page: Pick<CmsRenderablePage, "title" | "summary" | "path" | "seo">,
  canonicalPath?: string,
): Promise<Metadata> {
  return buildMetadata({
    title: normalizeText(page.seo?.title) || page.title,
    description: normalizeText(page.seo?.description) || normalizeText(page.summary) || undefined,
    image: page.seo?.imageUrl ?? null,
    keywords: [page.title, page.path],
    canonicalPath: canonicalPath ?? `/${page.path}`,
    openGraphType: "article",
  });
}
