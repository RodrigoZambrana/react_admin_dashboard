import { Fragment } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import ProductDetailExperience from "@component/products/ProductDetailExperience";
import StructuredData from "@/components/seo/StructuredData";
import ProductViewAnalytics from "@/components/seo/ProductViewAnalytics";
import ProductMultimediaCta from "@/components/products/ProductMultimediaCta";
import { CmsPageBody } from "@/components/cms/CmsPageShell";
import { buildProductBreadcrumbs, buildProductJsonLd } from "@/lib/seo/structured-data";
import { buildStorefrontPageMetadata, buildProductMetadata } from "@/lib/page-metadata";
import {
  loadProductPageData,
  buildProductSearchKey,
  type ProductPageSearchParams
} from "@/lib/storefront/product-page";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";

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
  const productData = await loadProductPageData(resolvedParams.slug, buildProductSearchKey(resolvedSearchParams), {
    cmsPagePath: `aberturas/${resolvedParams.slug}`,
  });

  if (!productData) {
    return buildStorefrontPageMetadata({
      title: "Producto no disponible",
      description: "No pudimos resolver la ficha del producto solicitado.",
      canonicalPath: `/aberturas/${resolvedParams.slug}`,
      noIndex: true,
    });
  }

  return buildProductMetadata(productData.productDetail, resolvedParams.slug, `/aberturas/${resolvedParams.slug}`);
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

  const productData = await loadProductPageData(resolvedParams.slug, buildProductSearchKey(resolvedSearchParams), {
    cmsPagePath: `aberturas/${resolvedParams.slug}`,
  });

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
