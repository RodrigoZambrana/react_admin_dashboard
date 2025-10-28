"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";

import Box from "@component/Box";
import Card from "@component/Card";
import Container from "@component/Container";
import FlexBox from "@component/FlexBox";
import Grid from "@component/grid/Grid";
import NextImage from "@component/NextImage";
import Spinner from "@component/Spinner";
import { Button } from "@component/buttons";
import DashboardNavigation from "@component/layout/DashboardNavigation";
import { H3, H6, Paragraph, Small } from "@component/Typography";

import ProductWishlistButton from "@/components/product-cards/ProductWishlistButton";
import { useWishlist } from "@/state/wishlist-context";

const formatMoney = (money?: { amount: number; currency: string; formatted?: string | null }) => {
  if (!money) {
    return "";
  }
  if (money.formatted) {
    return money.formatted;
  }
  const { amount, currency } = money;
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  return `${currency ?? ""} ${normalizedAmount.toFixed(2)}`.trim();
};

const formatAddedDate = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString();
};

export function WishlistContent() {
  const { items, count, isLoading, error, clearError, remove, isPending, refresh } = useWishlist();

  const handleRemove = useCallback(
    async (productId: number) => {
      try {
        await remove(productId);
      } catch {
        // errors surfaced through context error state
      }
    },
    [remove]
  );

  const emptyState = useMemo(
    () => ({
      title: "Your wishlist is empty",
      description: "Save products you love and revisit them anytime.",
      action: (
        <Link href="/shop">
          <Button variant="contained" color="primary">Browse products</Button>
        </Link>
      )
    }),
    []
  );

  return (
    <Box display="flex" flexDirection="column" gap="1.5rem">
      <Box display="flex" flexDirection="column" gap="0.5rem">
        <H3 fontSize="24px" fontWeight={700}>
          Wishlist
        </H3>
        <Paragraph color="gray.600">
          {count > 0
            ? `You have ${count} ${count === 1 ? "item" : "items"} saved for later.`
            : "Keep track of items you love and get back to them easily."}
        </Paragraph>
      </Box>

      {error ? (
        <Card bg="error.light" p="1rem" borderRadius={12}>
          <FlexBox justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="1rem">
            <Paragraph color="error.main" fontWeight={600}>
              {error}
            </Paragraph>
            <Button variant="outlined" size="small" onClick={clearError}>
              Dismiss
            </Button>
          </FlexBox>
        </Card>
      ) : null}

      {isLoading ? (
        <FlexBox minHeight="200px" flexDirection="column" justifyContent="center" alignItems="center" gap="1rem">
          <Spinner />
          <Paragraph color="gray.600">Loading your wishlist...</Paragraph>
        </FlexBox>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <Card p="2rem" borderRadius={16} textAlign="center">
          <Box mb="1rem">
            <H6 fontSize="18px" fontWeight={600}>
              {emptyState.title}
            </H6>
            <Paragraph color="gray.600">{emptyState.description}</Paragraph>
          </Box>
          {emptyState.action}
        </Card>
      ) : null}

      <Grid container spacing={3}>
        {items.map((item) => {
          const { product } = item;
          const productUrl = `/product/${encodeURIComponent(product.slug)}`;
          const imageUrl = product.thumbnail?.url;
          const imageAlt = product.thumbnail?.alt ?? product.name;
          const addedText = formatAddedDate(item.addedAt);
          const pending = isPending(item.productId);

          return (
            <Grid item key={item.productId} xs={12} sm={6}>
              <Card position="relative" p="1rem" height="100%" borderRadius={16}>
                <ProductWishlistButton
                  productId={item.productId}
                  style={{ position: "absolute", top: 16, right: 16 }}
                />

                <FlexBox flexDirection="column" gap="1rem" height="100%">
                  <Box
                    borderRadius={12}
                    overflow="hidden"
                    position="relative"
                    bg="gray.200"
                    minHeight="180px">
                    {imageUrl ? (
                      <NextImage
                        src={imageUrl}
                        alt={imageAlt}
                        width={400}
                        height={300}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <FlexBox
                        height="100%"
                        alignItems="center"
                        justifyContent="center"
                        color="gray.500">
                        No image available
                      </FlexBox>
                    )}
                  </Box>

                  <FlexBox flexDirection="column" gap="0.35rem" flex="1 1 auto">
                    <Link href={productUrl}>
                      <H6 fontSize="16px" fontWeight={600} color="inherit">
                        {product.name}
                      </H6>
                    </Link>
                    {product.shortDescription ? (
                      <Paragraph fontSize="14px" color="gray.600">
                        {product.shortDescription}
                      </Paragraph>
                    ) : null}
                    <Paragraph fontWeight={600} color="primary.main">
                      {formatMoney(product.salePrice ?? product.price)}
                    </Paragraph>
                    {addedText ? (
                      <Small color="gray.500">Added on {addedText}</Small>
                    ) : null}
                  </FlexBox>

                  <FlexBox gap="0.75rem" mt="auto" flexWrap="wrap">
                    <Link href={productUrl} style={{ flexGrow: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        color="primary"
                        style={{ width: "100%" }}>
                        View product
                      </Button>
                    </Link>

                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      disabled={pending}
                      onClick={() => {
                        void handleRemove(item.productId);
                      }}>
                      Remove
                    </Button>
                  </FlexBox>
                </FlexBox>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {items.length > 0 ? (
        <FlexBox justifyContent="flex-end">
          <Button
            variant="outlined"
            size="small"
            disabled={isLoading}
            onClick={() => void refresh()}>
            Refresh
          </Button>
        </FlexBox>
      ) : null}
    </Box>
  );
}

export default function WishlistPage() {
  return (
    <Container my="3rem">
      <Grid container spacing={6}>
        <Grid item lg={3} md={4} xs={12}>
          <DashboardNavigation />
        </Grid>

        <Grid item lg={9} md={8} xs={12}>
          <WishlistContent />
        </Grid>
      </Grid>
    </Container>
  );
}
