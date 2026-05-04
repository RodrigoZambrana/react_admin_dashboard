import { Fragment } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

import ProductDetailExperience from "@component/products/ProductDetailExperience";
import StructuredData from "@/components/seo/StructuredData";
import ProductViewAnalytics from "@/components/seo/ProductViewAnalytics";
import ProductMultimediaCta from "@/components/products/ProductMultimediaCta";
import { CmsPageBody } from "@/components/cms/CmsPageShell";
import { loadProductPageData, buildProductSearchKey, type ProductPageSearchParams } from "@/lib/storefront/product-page";
import { mapProductSummaryToProduct } from "@/lib/storefront/adapters";
import { buildResolvedSeoMetadata } from "@/lib/seo/resolved-metadata";
import { StorefrontApi } from "@/lib/api/storefront";

export const revalidate = 300;

const appendQueryString = (
  pathname: string,
  searchParams?: ProductPageSearchParams | undefined,
) => {
  if (!searchParams) {
    return pathname;
  }

  const params = new URLSearchParams();
  Object.entries(searchParams as Record<string, string | string[] | undefined>).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string" && entry.trim().length > 0) {
          params.append(key, entry.trim());
        }
      });
      return;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value.trim());
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductPageSearchParams | undefined>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const currentPath = `/product/${resolvedParams.slug}`;
  try {
    const seoDocument = await StorefrontApi.resolveSeo(currentPath);
    return buildResolvedSeoMetadata(seoDocument, { requestPath: currentPath });
  } catch {
    // Keep the legacy product lookup fallback for unpublished or partially migrated records.
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const productData = await loadProductPageData(resolvedParams.slug, buildProductSearchKey(resolvedSearchParams));

  if (!productData) {
    return buildResolvedSeoMetadata({
      entityType: "product",
      entityId: 0,
      tenantId: "global",
      slug: resolvedParams.slug,
      routePath: currentPath,
      title: "Producto no disponible",
      description: "No pudimos resolver la ficha del producto solicitado.",
      keywords: ["producto no disponible"],
      canonicalUrl: currentPath,
      robots: "noindex,nofollow",
      searchTerms: [],
      language: "es",
      semantic: {
        materials: [],
        dimensions: [],
        uses: [],
        attributes: [],
        customizations: [],
      },
    });
  }

  const seoDocument = await StorefrontApi.resolveSeo(currentPath);
  return buildResolvedSeoMetadata(seoDocument, { requestPath: currentPath });
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
  const currentPath = `/product/${resolvedParams.slug}`;
  const seoDocument = await StorefrontApi.resolveSeo(currentPath).catch(() => null);

  if (seoDocument && seoDocument.routePath !== currentPath) {
    permanentRedirect(appendQueryString(seoDocument.routePath, resolvedSearchParams));
  }

  const productData = await loadProductPageData(resolvedParams.slug, buildProductSearchKey(resolvedSearchParams));

  if (!productData) {
    notFound();
  }

  const { product, productDetail, relatedProducts, frequentlyBought, cmsPage } = productData;
  const structuredData = seoDocument?.schemaPayload
    ? Array.isArray(seoDocument.schemaPayload)
      ? seoDocument.schemaPayload
      : [seoDocument.schemaPayload]
    : [];

  return (
    <Fragment>
      <StructuredData schemas={structuredData} />
      <section style={{ padding: "1.5rem 1rem 0", maxWidth: "1280px", margin: "0 auto" }}>
        <h1>{seoDocument?.title ?? product.title}</h1>
        <p>{seoDocument?.description ?? productDetail.description ?? product.title}</p>
        {productDetail.specifications?.length ? (
          <ul>
            {productDetail.specifications.slice(0, 6).map((spec) => (
              <li key={`${spec.label}-${spec.value}`}>
                {spec.label}: {spec.value}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
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
