import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailExperience from "@component/products/ProductDetailExperience";
import type Product from "@models/product.model";
import type Shop from "@models/shop.model";
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

const resolveProductDetail = async (slug: string, searchParams?: ProductPageSearchParams) => {
  const identifierCandidates = collectProductIdentifiers(slug, searchParams);

  for (const identifier of identifierCandidates) {
    try {
      return await StorefrontApi.getProduct(identifier);
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        continue;
      }
      console.warn(`[product] Failed to load product using identifier "${identifier}"`, error);
      break;
    }
  }

  return null;
};

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductPageSearchParams | undefined>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const productDetail = await resolveProductDetail(resolvedParams.slug, resolvedSearchParams);

  if (!productDetail) {
    return buildStorefrontPageMetadata({
      title: "Producto no disponible",
      description: "No pudimos resolver la ficha del producto solicitado.",
      canonicalPath: `/product/${resolvedParams.slug}`,
      noIndex: true,
    });
  }

  return buildProductMetadata(productDetail, resolvedParams.slug);
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

  let productDetail: ProductDetail | null = null;
  let product: Product | null = null;
  let relatedProducts: Product[] = [];
  let frequentlyBought: Product[] = [];
  let shops: Shop[] = [];

  productDetail = await resolveProductDetail(slug, resolvedSearchParams);

  if (productDetail) {
    product = mapProductDetailToProduct(productDetail);
    frequentlyBought = Array.isArray(productDetail.frequentlyBoughtTogether)
      ? productDetail.frequentlyBoughtTogether.map(mapProductSummaryToProduct)
      : [];

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
  }

  if (!product) {
    notFound();
  }

  const storefrontConfig = await getStorefrontConfig();
  const cmsPage = await StorefrontApi.getCmsPage(`product/${slug}`).catch(() => null);
  const safeProductDetail = productDetail as ProductDetail;
  const structuredData = [
    buildProductJsonLd(storefrontConfig, safeProductDetail, resolvedParams.slug),
    buildProductBreadcrumbs(storefrontConfig, { slug: product.slug, title: product.title }),
  ];

  return (
    <Fragment>
      <StructuredData schemas={structuredData} />
      <ProductViewAnalytics product={product} />
      <ProductDetailExperience
        product={product}
        shops={shops}
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
