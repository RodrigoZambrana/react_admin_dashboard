"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

import Grid from "@component/grid/Grid";
import Container from "@component/Container";
import { H2, H4, Paragraph } from "@component/Typography";
import SkeletonPanel from "@/components/status/SkeletonPanel";
import TranslatedText from "@component/i18n/TranslatedText";
import { CategoryWrapper, CategoryTitle } from "./Section10.styles";
import { flattenCategorySummaries, FALLBACK_CATEGORY_IMAGE } from "@/lib/storefront/adapters";
import type { CategorySummary } from "@/types/storefront";
import { useStorefrontCategoriesResource } from "@/hooks/useStorefrontCategories";
import { useTranslation } from "@/state/i18n-context";

const hasCatalogPresence = (category: CategorySummary): boolean => {
  if ((category.productCount ?? 0) > 0) return true;
  return (category.children ?? []).some(hasCatalogPresence);
};

export default function Section10() {
  const t = useTranslation();
  const { data, status } = useStorefrontCategoriesResource();

  const categories = useMemo(
    () =>
      flattenCategorySummaries(data ?? [])
        .filter((category) => !category.parentId)
        .filter(hasCatalogPresence)
        .slice(0, 8),
    [data]
  );

  return (
    <Container mb="70px">
      <H2 textAlign="center" mb={4} fontWeight={700}>
        <TranslatedText
          translationKey="home.categories.heading"
          defaultMessage="Explore Popular Categories"
        />
      </H2>

      {status === "loading" && categories.length === 0 ? (
        <SkeletonPanel lines={4} height={12} />
      ) : categories.length === 0 ? (
        <Paragraph textAlign="center" color="text.muted">
          {t("home.categories.empty", {
            defaultMessage: "We couldn't load the categories right now.",
          })}
        </Paragraph>
      ) : (
        <Grid container spacing={6}>
          {categories.map((category) => (
            <Grid item md={3} sm={6} xs={12} key={category.id}>
              <Link href={`/shop?category=${encodeURIComponent(category.slug)}`} style={{ display: "block" }}>
                <CategoryWrapper>
                  <Image
                    width={400}
                    height={400}
                    src={category.thumbnail?.url ?? FALLBACK_CATEGORY_IMAGE}
                    alt={category.name ?? "category"}
                    style={{ width: "100%", height: "auto", objectFit: "cover" }}
                  />

                  <CategoryTitle className="category-title">
                    <H4 fontWeight={600}>{category.name}</H4>
                  </CategoryTitle>
                </CategoryWrapper>
              </Link>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
