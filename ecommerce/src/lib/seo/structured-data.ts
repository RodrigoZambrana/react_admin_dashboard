import type {
  CategorySummary,
  CmsRenderablePage,
  ProductDetail,
  ProductSummary,
  StorefrontConfig,
} from "@/types/storefront";
import { resolvePublicPricing } from "./public-pricing";
import { resolveAbsoluteUrl, resolveStorefrontOrigin } from "./urls";

type JsonLdValue = Record<string, unknown> | Record<string, unknown>[];
type FaqQuestionJsonLd = {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
};

export const serializeJsonLd = (value: JsonLdValue): string =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

const trimText = (value?: string | null): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length ? normalized : undefined;
};

const stripHtml = (value?: string | null): string | undefined => {
  const text = trimText(value);
  if (!text) return undefined;
  const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length ? stripped : undefined;
};

const extractPlainText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return stripHtml(value);
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => extractPlainText(item))
      .filter((item): item is string => Boolean(item));
    const joined = parts.join(" ").replace(/\s+/g, " ").trim();
    return joined.length ? joined : undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.value === "string") {
    return stripHtml(record.value);
  }

  if (Array.isArray(record.children)) {
    return extractPlainText(record.children);
  }

  if (Array.isArray(record.nodes)) {
    return extractPlainText(record.nodes);
  }

  return undefined;
};

const resolveBrandName = (config: Pick<StorefrontConfig, "seo" | "companyProfile">): string => {
  return (
    trimText(config.seo?.siteName) ||
    trimText(config.companyProfile?.tradeName) ||
    trimText(config.companyProfile?.legalName) ||
    "Storefront"
  );
};

const resolveBrandUrl = (config: Pick<StorefrontConfig, "companyProfile">): string | undefined => {
  const website = trimText(config.companyProfile?.website);
  if (!website) return undefined;
  return resolveAbsoluteUrl("/", config);
};

const resolveImageUrl = (
  image: string | { url?: string | null } | null | undefined,
  config?: Pick<StorefrontConfig, "companyProfile"> | null,
): string | undefined => {
  if (!image) return undefined;
  const value = typeof image === "string" ? image : image.url ?? undefined;
  const trimmed = trimText(value);
  if (!trimmed) return undefined;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")
    ? trimmed
    : resolveAbsoluteUrl(trimmed, config);
};

export const buildOrganizationJsonLd = (config: Pick<StorefrontConfig, "seo" | "companyProfile">) => {
  const brandName = resolveBrandName(config);
  const website = resolveBrandUrl(config);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brandName,
    legalName: trimText(config.companyProfile?.legalName) || undefined,
    url: website,
    logo: resolveImageUrl(config.companyProfile?.seoImageUrl ?? config.companyProfile?.logo ?? null, config)
      || undefined,
  };
};

export const buildWebSiteJsonLd = (
  config: Pick<StorefrontConfig, "seo" | "companyProfile">,
  searchPath = "/shop?search={search_term_string}",
) => {
  const siteUrl = resolveStorefrontOrigin(config);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: resolveBrandName(config),
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: new URL(searchPath, siteUrl).toString(),
      "query-input": "required name=search_term_string",
    },
  };
};

export const buildBreadcrumbJsonLd = (items: Array<{ name: string; url: string }>) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: trimText(item.name) || item.name,
      item: item.url,
    })),
  };
};

export const buildCollectionPageJsonLd = (
  config: Pick<StorefrontConfig, "seo" | "companyProfile">,
  collection: {
    name: string;
    description?: string | null;
    url: string;
    image?: string | { url?: string | null } | null;
  },
) => {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: trimText(collection.name) || collection.name,
    description: trimText(collection.description),
    url: collection.url,
    isPartOf: {
      "@type": "WebSite",
      name: resolveBrandName(config),
      url: resolveStorefrontOrigin(config),
    },
    image: resolveImageUrl(collection.image, config),
  };
};

export const buildArticleJsonLd = (
  config: Pick<StorefrontConfig, "seo" | "companyProfile">,
  page: Pick<CmsRenderablePage, "title" | "summary" | "path" | "seo" | "updatedAt">,
) => {
  const url = resolveAbsoluteUrl(page.path, config);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: trimText(page.seo?.title) || page.title,
    description: trimText(page.seo?.description) || trimText(page.summary),
    url,
    dateModified: page.updatedAt ?? undefined,
    image: resolveImageUrl(page.seo?.imageUrl ?? null, config),
    publisher: buildOrganizationJsonLd(config),
  };
};

export const buildCmsFaqJsonLd = (
  page: Pick<CmsRenderablePage, "sections" | "title" | "path">,
) => {
  const questions = page.sections
    .filter((section) => section.type === "FAQ")
    .flatMap((section) =>
      section.blocks
        .map((block) => {
          const content = (block.content ?? {}) as Record<string, unknown>;
          const question = trimText(
            (typeof content.question === "string" ? content.question : null) ??
              (typeof block.name === "string" ? block.name : null),
          );
          const answer =
            extractPlainText(content.answerRichText) ||
            extractPlainText(content.richText) ||
            extractPlainText(content.answer) ||
            extractPlainText(content.body) ||
            extractPlainText(content.description);

          if (!question || !answer) {
            return null;
          }

          return {
            "@type": "Question",
            name: question,
            acceptedAnswer: {
              "@type": "Answer",
              text: answer,
            },
          };
        })
        .filter((item) => Boolean(item)) as FaqQuestionJsonLd[],
    );

  if (!questions.length) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions,
  };
};

export const buildProductJsonLd = (
  config: Pick<StorefrontConfig, "seo" | "companyProfile">,
  product: Pick<
    ProductDetail,
    | "name"
    | "shortDescription"
    | "description"
    | "descriptionHtml"
    | "slug"
    | "price"
    | "salePrice"
    | "thumbnail"
    | "gallery"
    | "inventoryStatus"
    | "categories"
  > & {
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoImageUrl?: string | null;
  },
  canonicalSlug?: string,
) => {
  const image = product.seoImageUrl ?? product.thumbnail ?? product.gallery?.[0] ?? null;
  const resolvedImage = resolveImageUrl(image, config);
  const productUrl = resolveAbsoluteUrl(`/product/${canonicalSlug || product.slug}`, config);
  const brandName = resolveBrandName(config);
  const pricing = resolvePublicPricing({
    currency: product.salePrice?.currency ?? product.price.currency,
    price: product.price,
    salePrice: product.salePrice,
  });

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: trimText(product.seoTitle) || product.name,
    description:
      trimText(product.seoDescription) ||
      trimText(product.shortDescription) ||
      trimText(product.description) ||
      trimText(product.descriptionHtml?.replace(/<[^>]*>/g, " ")),
    image: resolvedImage ? [resolvedImage] : undefined,
    url: productUrl,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      price: pricing.publicPrice.amount,
      priceCurrency: pricing.currency,
      availability:
        product.inventoryStatus === "out-of-stock"
          ? "https://schema.org/OutOfStock"
          : product.inventoryStatus === "back-order"
            ? "https://schema.org/BackOrder"
            : product.inventoryStatus === "limited"
              ? "https://schema.org/LimitedAvailability"
              : "https://schema.org/InStock",
    },
    category: Array.isArray(product.categories)
      ? product.categories.map((category: CategorySummary | { name: string }) => category.name)
      : undefined,
  };
};

export const buildProductBreadcrumbs = (
  config: Pick<StorefrontConfig, "seo" | "companyProfile">,
  product: Pick<ProductSummary, "slug"> & { name?: string; title?: string },
) =>
  buildBreadcrumbJsonLd([
    { name: resolveBrandName(config), url: resolveAbsoluteUrl("/", config) },
    { name: "Shop", url: resolveAbsoluteUrl("/shop", config) },
    { name: product.name ?? product.title ?? product.slug, url: resolveAbsoluteUrl(`/product/${product.slug}`, config) },
  ]);

export const buildCmsBreadcrumbs = (
  config: Pick<StorefrontConfig, "seo" | "companyProfile">,
  page: Pick<CmsRenderablePage, "title" | "path">,
) =>
  buildBreadcrumbJsonLd([
    { name: resolveBrandName(config), url: resolveAbsoluteUrl("/", config) },
    { name: page.title, url: resolveAbsoluteUrl(page.path, config) },
  ]);
