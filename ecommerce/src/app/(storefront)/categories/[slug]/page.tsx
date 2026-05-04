import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Box from "@component/Box";
import Container from "@component/Container";
import Grid from "@component/grid/Grid";
import { H1, Paragraph } from "@component/Typography";
import StorefrontProductCard from "@component/product-cards/StorefrontProductCard";

import StructuredData from "@/components/seo/StructuredData";
import { CmsPageBody } from "@/components/cms/CmsPageShell";
import { StorefrontApi } from "@/lib/api/storefront";
import { flattenCategorySummaries } from "@/lib/storefront/adapters";
import { mapProductSummaryToCardProps } from "@/components/category/mapProductSummaryToCard";
import { buildResolvedSeoMetadata } from "@/lib/seo/resolved-metadata";
import type { CategorySummary, ResolvedSeoMetadata } from "@/types/storefront";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

const buildFallbackCategorySeo = (
  slug: string,
  category?: CategorySummary | null,
): ResolvedSeoMetadata => {
  const title = category?.name?.trim() || slug;
  const description =
    category?.description?.trim() ||
    `Explora ${title} con una ruta indexable, metadata automatica y productos relacionados.`;

  return {
    entityType: "category",
    entityId: category?.id ?? 0,
    tenantId: "urucortinas",
    slug,
    routePath: `/categories/${slug}`,
    title,
    description,
    keywords: [title],
    canonicalUrl: `/categories/${slug}`,
    robots: "index,follow",
    searchTerms: [title],
    language: "es",
    semantic: {
      materials: [],
      dimensions: [],
      uses: [title],
      attributes: [],
      productType: "category",
      category: title,
      customizations: [],
    },
  };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const currentPath = `/categories/${resolvedParams.slug}`;

  try {
    const seoDocument = await StorefrontApi.resolveSeo(currentPath);
    return buildResolvedSeoMetadata(seoDocument, { requestPath: currentPath });
  } catch {
    const categoriesTree = await StorefrontApi.listCategories().catch(() => []);
    const category = flattenCategorySummaries(categoriesTree).find(
      (entry) => entry.slug === resolvedParams.slug,
    );
    return buildResolvedSeoMetadata(buildFallbackCategorySeo(resolvedParams.slug, category), {
      requestPath: currentPath,
    });
  }
}

export default async function CategoryDetailsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const currentPath = `/categories/${resolvedParams.slug}`;

  const [seoDocument, categoriesTree, productsPage, cmsPage] = await Promise.all([
    StorefrontApi.resolveSeo(currentPath).catch(() => null),
    StorefrontApi.listCategories(),
    StorefrontApi.listProducts({
      categorySlug: resolvedParams.slug,
      page: 1,
      pageSize: 24,
      sort: "featured",
    }),
    StorefrontApi.getCmsPage(`categories/${resolvedParams.slug}`).catch(() => null),
  ]);

  const category = flattenCategorySummaries(categoriesTree).find((entry) => entry.slug === resolvedParams.slug);
  const resolvedSeoDocument = seoDocument ?? buildFallbackCategorySeo(resolvedParams.slug, category);

  if (!category) {
    notFound();
  }

  const cards = productsPage.data.map(mapProductSummaryToCardProps);
  const schemas = resolvedSeoDocument.schemaPayload
    ? Array.isArray(resolvedSeoDocument.schemaPayload)
      ? resolvedSeoDocument.schemaPayload
      : [resolvedSeoDocument.schemaPayload]
    : [];

  return (
    <>
      <StructuredData schemas={schemas} />
      <Container py="2rem">
        <Box mb="1.5rem">
          <H1 mb="0.75rem">{resolvedSeoDocument.title}</H1>
          <Paragraph color="text.muted">{category.description ?? resolvedSeoDocument.description}</Paragraph>
        </Box>

        {cmsPage ? (
          <Box mb="2rem">
            <CmsPageBody page={cmsPage} />
          </Box>
        ) : null}

        <Grid container spacing={4}>
          {cards.map((card) => (
            <Grid item lg={3} md={4} sm={6} xs={12} key={`${card.slug}-${card.id}`}>
              <StorefrontProductCard {...card} />
            </Grid>
          ))}
        </Grid>

        {cards.length === 0 ? (
          <Box py="2rem">
            <Paragraph color="text.muted">
              Todavia no hay productos publicados para esta categoria.
            </Paragraph>
          </Box>
        ) : null}
      </Container>
    </>
  );
}
