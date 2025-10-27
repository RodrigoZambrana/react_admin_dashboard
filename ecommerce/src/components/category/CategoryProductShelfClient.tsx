"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Hidden from "@component/hidden";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Container from "@component/Container";
import { Button } from "@component/buttons";
import { Paragraph } from "@component/Typography";
import CategorySectionHeader from "@component/CategorySectionHeader";
import Spinner from "@component/Spinner";
import StorefrontProductCard, {
  type StorefrontProductCardProps
} from "@component/product-cards/StorefrontProductCard";
import { StorefrontApi } from "@/lib/api/storefront";
import type { ProductSummary } from "@/types/storefront";
import { mapProductSummaryToCardProps } from "./mapProductSummaryToCard";

const CategoryListContainer = styled(Box)(({ theme }) => ({
  width: 260,
  padding: "1.25rem",
  borderRadius: "10px",
  backgroundColor: theme.colors.body.paper,
  boxShadow: theme.shadows.small,
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem"
}));

const CategoryButton = styled.button<{ $active: boolean }>(({ theme, $active }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  border: 0,
  cursor: "pointer",
  borderRadius: "6px",
  padding: "0.65rem 0.75rem",
  textTransform: "capitalize",
  fontWeight: 600,
  backgroundColor: $active ? theme.colors.primary.light : theme.colors.gray[100],
  color: $active ? theme.colors.primary.main : theme.colors.text.secondary,
  transition: "background-color 0.2s ease, color 0.2s ease",
  "&:hover": {
    backgroundColor: theme.colors.primary.light,
    color: theme.colors.primary.main
  }
}));

const MobileCategoryScroller = styled.div({
  display: "flex",
  width: "100%",
  overflowX: "auto",
  gap: "0.75rem",
  padding: "0.5rem 0"
});

const MobileCategoryButton = styled.button<{ $active: boolean }>(({ theme, $active }) => ({
  border: 0,
  padding: "0.5rem 0.85rem",
  borderRadius: "999px",
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "capitalize",
  backgroundColor: $active ? theme.colors.primary.main : theme.colors.gray[200],
  color: $active ? theme.colors.gray[0] : theme.colors.text.secondary,
  transition: "background-color 0.2s ease, color 0.2s ease"
}));

export type CategoryProductShelfClientProps = {
  title: string;
  categories: Array<{ slug: string; name: string }>;
  initialCategorySlug: string;
  initialProducts: StorefrontProductCardProps[];
  seeMoreLink?: string;
  fetchPageSize?: number;
  emptyStateText?: string;
};

export default function CategoryProductShelfClient({
  title,
  categories,
  initialCategorySlug,
  initialProducts,
  seeMoreLink,
  fetchPageSize = 9,
  emptyStateText = "No products found in this category."
}: CategoryProductShelfClientProps) {
  const [activeCategory, setActiveCategory] = useState(initialCategorySlug);
  const [productsByCategory, setProductsByCategory] = useState<Record<string, StorefrontProductCardProps[]>>({
    [initialCategorySlug]: initialProducts
  });
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [errorSlug, setErrorSlug] = useState<string | null>(null);

  const activeProducts = productsByCategory[activeCategory] ?? [];
  const isLoading = loadingSlug === activeCategory;
  const showError = errorSlug === activeCategory;

  const handleSelectCategory = useCallback((slug: string) => {
    setActiveCategory(slug);
    setErrorSlug(null);
  }, []);

  useEffect(() => {
    if (!activeCategory || productsByCategory[activeCategory]) return;

    let cancelled = false;
    setLoadingSlug(activeCategory);

    const loadProducts = async () => {
      try {
        const response = await StorefrontApi.listProducts({
          categorySlug: activeCategory,
          pageSize: fetchPageSize,
          sort: "featured"
        });

        if (cancelled) return;

        const mapped = response.data.map((product: ProductSummary) =>
          mapProductSummaryToCardProps(product)
        );

        setProductsByCategory((prev) => ({ ...prev, [activeCategory]: mapped }));
      } catch (error) {
        if (!cancelled) {
          setErrorSlug(activeCategory);
        }
      } finally {
        if (!cancelled) {
          setLoadingSlug(null);
        }
      }
    };

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [activeCategory, fetchPageSize, productsByCategory]);

  const categoryOptions = useMemo(() => {
    if (categories.length > 0) return categories;
    if (initialCategorySlug) {
      return [{ slug: initialCategorySlug, name: initialCategorySlug }];
    }
    return [];
  }, [categories, initialCategorySlug]);

  return (
    <Container mb="80px">
      <FlexBox flexWrap="wrap" alignItems="flex-start" style={{ gap: "1.5rem" }}>
        <Hidden down={768} mr="1.75rem">
          <CategoryListContainer>
            {categoryOptions.map((category) => (
              <CategoryButton
                key={category.slug}
                type="button"
                $active={category.slug === activeCategory}
                onClick={() => handleSelectCategory(category.slug)}>
                {category.name}
              </CategoryButton>
            ))}
          </CategoryListContainer>
        </Hidden>

        <Box flex="1 1 0" minWidth="0px">
          <CategorySectionHeader title={title} seeMoreLink={seeMoreLink} />

          <Hidden up={768}>
            <MobileCategoryScroller>
              {categoryOptions.map((category) => (
                <MobileCategoryButton
                  key={category.slug}
                  type="button"
                  $active={category.slug === activeCategory}
                  onClick={() => handleSelectCategory(category.slug)}>
                  {category.name}
                </MobileCategoryButton>
              ))}
            </MobileCategoryScroller>
          </Hidden>

          {isLoading ? (
            <FlexBox alignItems="center" justifyContent="center" minHeight="200px">
              <Spinner />
            </FlexBox>
          ) : showError ? (
            <FlexBox
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
              minHeight="200px"
              style={{ gap: "0.75rem" }}>
              <Paragraph color="error.main" textAlign="center">
                Unable to load products right now.
              </Paragraph>
              <Button
                variant="outlined"
                onClick={() => {
                  setProductsByCategory((prev) => {
                    const next = { ...prev };
                    delete next[activeCategory];
                    return next;
                  });
                  setErrorSlug(null);
                }}>
                Retry
              </Button>
            </FlexBox>
          ) : activeProducts.length === 0 ? (
            <FlexBox alignItems="center" justifyContent="center" minHeight="200px">
              <Paragraph color="text.muted" textAlign="center">
                {emptyStateText}
              </Paragraph>
            </FlexBox>
          ) : (
            <Grid container spacing={6}>
              {activeProducts.map((product) => (
                <Grid item lg={4} sm={6} xs={12} key={product.id}>
                  <StorefrontProductCard {...product} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </FlexBox>
    </Container>
  );
}
