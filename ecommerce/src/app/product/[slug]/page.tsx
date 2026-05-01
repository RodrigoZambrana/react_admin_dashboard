import { Fragment, cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailExperience from "@component/products/ProductDetailExperience";
import type Product from "@models/product.model";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { buildProductMetadata, buildStorefrontPageMetadata } from "@/lib/page-metadata";
import { getStorefrontConfig } from "@/lib/storefront-config";
import { mapProductDetailToProduct, mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import StructuredData from "@/components/seo/StructuredData";
import ProductViewAnalytics from "@/components/seo/ProductViewAnalytics";
import { buildProductBreadcrumbs, buildProductJsonLd } from "@/lib/seo/structured-data";
import type { ProductDetail } from "@/types/storefront";
import { CmsPageBody } from "@/components/cms/CmsPageShell";
import ProductMultimediaCta from "@/components/products/ProductMultimediaCta";

interface ProductPageSearchParams {
  id?: string | string[];
  productId?: string | string[];
}

export const revalidate = 300;

// ==============================================================
const coerceParamToString = (value?: string | string[]): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const firstNonEmpty = value.find((entry) => typeof entry === "string" && entry.trim().length > 0);
    return firstNonEmpty ? firstNonEmpty.trim() : null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const collectProductIdentifiers = (slug: string, searchParams?: ProductPageSearchParams): string[] => {
  const identifiers: string[] = [];
  const addIdentifier = (candidate: string | null | undefined) => {
    if (!candidate) return;
    const normalized = candidate.trim();
    if (!normalized || identifiers.includes(normalized)) return;
    identifiers.push(normalized);
  };

  if (searchParams) {
    addIdentifier(coerceParamToString(searchParams.id));
    addIdentifier(coerceParamToString(searchParams.productId));
  }

  addIdentifier(slug);

  const numericSuffixMatch = slug.match(/(\d+)(?!.*\d)/);
  if (numericSuffixMatch) {
    addIdentifier(numericSuffixMatch[0]);
  }

  return identifiers;
};

const buildSearchKey = (searchParams?: ProductPageSearchParams) =>
  [coerceParamToString(searchParams?.id) ?? "", coerceParamToString(searchParams?.productId) ?? ""].join("|");

const loadProductPageData = cache(async (slug: string, searchKey: string) => {
  const [searchId, searchProductId] = searchKey.split("|");
  const searchParams: ProductPageSearchParams | undefined =
    searchId.length || searchProductId.length
      ? {
          id: searchId.length ? searchId : undefined,
          productId: searchProductId.length ? searchProductId : undefined,
        }
      : undefined;
  const identifierCandidates = collectProductIdentifiers(slug, searchParams);

  let productDetail: ProductDetail | null = null;

  for (const identifier of identifierCandidates) {
    try {
      productDetail = await StorefrontApi.getProduct(identifier, slug);
      break;
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        continue;
      }
      console.warn(`[product] Failed to load product using identifier "${identifier}"`, error);
      break;
    }
  }

  if (!productDetail) {
    return null;
  }

  const product = mapProductDetailToProduct(productDetail);
  const frequentlyBought = Array.isArray(productDetail.frequentlyBoughtTogether)
    ? productDetail.frequentlyBoughtTogether.map(mapProductSummaryToProduct)
    : [];

  let relatedProducts: Product[] = [];
  try {
    const recommendations = await StorefrontApi.getRecommendations(productDetail.id, 8);
    if (recommendations.length > 0) {
      relatedProducts = recommendations.map(mapProductSummaryToProduct);
    }
  } catch (recommendationError) {
    if (!isApiError(recommendationError)) {
      console.warn("[product] Failed to load recommendations.", recommendationError);
    }
  }

  if (Array.isArray(productDetail.relatedProducts) && productDetail.relatedProducts.length > 0) {
    relatedProducts = productDetail.relatedProducts.map(mapProductSummaryToProduct);
  }

  const [storefrontConfig, cmsPage] = await Promise.all([
    getStorefrontConfig(),
    StorefrontApi.getCmsPage(`product/${slug}`).catch(() => null),
  ]);

  return {
    productDetail,
    product,
    relatedProducts,
    frequentlyBought,
    storefrontConfig,
    cmsPage,
  };
});

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductPageSearchParams | undefined>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const productData = await loadProductPageData(resolvedParams.slug, buildSearchKey(resolvedSearchParams));

  if (!productData) {
    return buildStorefrontPageMetadata({
      title: "Producto no disponible",
      description: "No pudimos resolver la ficha del producto solicitado.",
      canonicalPath: `/product/${resolvedParams.slug}`,
      noIndex: true,
    });
  }

  return buildProductMetadata(productData.productDetail, resolvedParams.slug);
}

export default async function ProductDetails({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductPageSearchParams | undefined>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const { slug } = resolvedParams;
  const productData = await loadProductPageData(slug, buildSearchKey(resolvedSearchParams));

  if (!productData) {
    notFound();
  }

  const { product, productDetail, relatedProducts, frequentlyBought, storefrontConfig, cmsPage } = productData;
  const structuredData = [
    buildProductJsonLd(storefrontConfig, productDetail, resolvedParams.slug),
    buildProductBreadcrumbs(storefrontConfig, { slug: product.slug, title: product.title }),
  ];

  return (
    <Fragment>
      <StructuredData schemas={structuredData} />
      <ProductViewAnalytics product={product} />
      <ProductDetailExperience
        product={product}
        shops={[]}
        relatedProducts={relatedProducts}
        frequentlyBought={frequentlyBought}
        suggestedAddOns={
          Array.isArray(productDetail?.suggestedAddOns)
            ? productDetail.suggestedAddOns.map(mapProductSummaryToProduct)
            : []
        }
        beforeDetails={
          <>
            <ProductMultimediaCta product={product} />
            {cmsPage ? <CmsPageBody page={cmsPage} /> : null}
          </>
        }
        installationAddOn={productDetail?.installationAddOn ?? null}
        reviews={Array.isArray(productDetail?.reviews) ? productDetail.reviews : []}
        reviewSummary={productDetail?.reviewSummary ?? null}
      />
    </Fragment>
  );
}
