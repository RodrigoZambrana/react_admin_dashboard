import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import CmsPageShell, { CmsPageBody } from "@/components/cms/CmsPageShell";
import ProductDetailExperience from "@component/products/ProductDetailExperience";
import StructuredData from "@/components/seo/StructuredData";
import ProductViewAnalytics from "@/components/seo/ProductViewAnalytics";
import ProductMultimediaCta from "@/components/products/ProductMultimediaCta";
import {
  buildArticleJsonLd,
  buildCmsBreadcrumbs,
  buildCmsFaqJsonLd,
  buildProductBreadcrumbs,
  buildProductJsonLd,
} from "@/lib/seo/structured-data";
import {
  buildStorefrontPageMetadata,
  buildProductMetadata,
  buildCmsPageMetadata,
} from "@/lib/page-metadata";
import { loadProductPageData, buildProductSearchKey, type ProductPageSearchParams } from "@/lib/storefront/product-page";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import { getStorefrontConfig } from "@/lib/storefront-config";

export const revalidate = 300;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductPageSearchParams | undefined>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const productData = await loadProductPageData(resolvedParams.slug, buildProductSearchKey(resolvedSearchParams));

  if (!productData) {
    const { StorefrontApi } = await import("@/lib/api/storefront");
    try {
      const cmsPage = await StorefrontApi.getCmsPage(resolvedParams.slug);
      return buildCmsPageMetadata(cmsPage, `/${resolvedParams.slug}`);
    } catch {
      return buildStorefrontPageMetadata({
        title: "Producto no disponible",
        description: "No pudimos resolver la ficha del producto solicitado.",
        canonicalPath: `/${resolvedParams.slug}`,
        noIndex: true,
      });
    }
  }

  return buildProductMetadata(productData.productDetail, resolvedParams.slug, `/${resolvedParams.slug}`);
}

export default async function ProductDetails({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductPageSearchParams | undefined>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const productData = await loadProductPageData(resolvedParams.slug, buildProductSearchKey(resolvedSearchParams));

  if (!productData) {
    const { StorefrontApi } = await import("@/lib/api/storefront");
    try {
      const cmsPage = await StorefrontApi.getCmsPage(resolvedParams.slug);
      const config = await getStorefrontConfig();
      const faqSchema = buildCmsFaqJsonLd(cmsPage);
      return (
        <>
          <StructuredData
            schemas={[
              buildArticleJsonLd(config, cmsPage),
              buildCmsBreadcrumbs(config, cmsPage),
              ...(faqSchema ? [faqSchema] : []),
            ]}
          />
          <CmsPageShell page={cmsPage} />
        </>
      );
    } catch {
      notFound();
    }
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
