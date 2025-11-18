"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Rating from "@component/rating";
import NextImage from "@component/NextImage";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { H4, Paragraph, Small } from "@component/Typography";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import type { InventoryStatus, ProductMode, ProductVariantAttribute } from "@/types/storefront";

const Wrapper = styled(Box)({
  position: "relative",
  "&:hover": {
    "& img": { transform: "scale(1.05)" },
    "& .product-view-action": { opacity: 1, transform: "translateY(0)" },
    ".overlay-actions": {
      opacity: 1,
      pointerEvents: "auto",
      transform: "none"
    }
  },
  "@media (hover: none)": {
    ".overlay-actions": {
      opacity: 1,
      pointerEvents: "auto",
      transform: "none"
    }
  }
});

const Media = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  borderRadius: "8px",
  backgroundColor: theme.colors.gray[200],
  "& img": { transition: "transform 0.35s ease" }
}));

export type StorefrontProductCardProps = {
  id: string | number;
  slug: string;
  title: string;
  price: number;
  imgUrl?: string | null;
  images?: Array<string | null | undefined>;
  category?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  currencyCode?: string;
  inventoryStatus?: InventoryStatus;
  mode?: ProductMode;
  attributes?: ProductVariantAttribute[];
  variantId?: number | null;
  variantKey?: string | null;
  variantLabel?: string | null;
  configuration?: Record<string, unknown> | null;
};

export default function StorefrontProductCard({
  id,
  slug,
  title,
  price,
  imgUrl,
  images,
  category,
  rating,
  reviewCount,
  currencyCode,
  inventoryStatus,
  mode,
  attributes,
  variantId,
  variantKey,
  variantLabel,
  configuration
}: StorefrontProductCardProps) {
  const { state, dispatch } = useCart();
  const { formatAmount, baseCurrency } = useMoneyFormatter();

  const cartItem = state.cart.find((item) => item.id === id || item.slug === slug);
  const primaryImage = typeof imgUrl === "string" && imgUrl.trim() ? imgUrl.trim() : undefined;
  const gallery = useMemo(() => {
    const list =
      Array.isArray(images) && images.length > 0
        ? images.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
    if (primaryImage) {
      list.unshift(primaryImage);
    }
    return Array.from(new Set(list));
  }, [images, primaryImage]);

  const handleAddToCart = useCallback(() => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: {
        id,
        slug,
        price,
        currency: currencyCode ?? baseCurrency,
        imgUrl: primaryImage,
        name: title,
        qty: (cartItem?.qty ?? 0) + 1,
        inventoryStatus,
        mode,
        attributes,
        variantId,
        variantKey,
        variantLabel,
        configuration: configuration ?? undefined
      }
    });
  }, [
    attributes,
    baseCurrency,
    cartItem?.qty,
    configuration,
    currencyCode,
    dispatch,
    id,
    inventoryStatus,
    mode,
    primaryImage,
    price,
    slug,
    title,
    variantId,
    variantKey,
    variantLabel
  ]);

  const normalizedRating = typeof rating === "number" ? rating : null;
  const normalizedReviews = typeof reviewCount === "number" ? reviewCount : null;
  const resolvedCurrency = currencyCode ?? baseCurrency;
  const formattedPrice = formatAmount(price, resolvedCurrency);

  return (
    <Wrapper>
      <Media>
        <Link href={`/product/${slug}`}>
          {primaryImage ? (
            <NextImage
              width={300}
              height={300}
              alt={title}
              src={primaryImage}
              style={{ width: "100%", height: "auto", objectFit: "cover" }}
            />
          ) : (
            <NoImagePlaceholder height="300px" width="100%" text="No image available" />
          )}
        </Link>

        <ProductQuickActions
          className="product-actions overlay-actions"
          direction="column"
          style={{ position: "absolute", top: 12, right: 12 }}
          compact
          showQuickViewButton
          productId={id}
          productSlug={slug}
          productTitle={title}
          productPrice={price}
          productCurrency={resolvedCurrency}
          productImages={gallery}
          productImage={primaryImage}
          onAddToCart={handleAddToCart}
        />
      </Media>

      <Box pt={2} textAlign="center">
        {category ? (
          <Small color="gray.500" display="block" mb="0.25rem">
            {category}
          </Small>
        ) : null}

        <Link href={`/product/${slug}`}>
          <Paragraph fontWeight="600" mb="0.35rem">
            {title}
          </Paragraph>
        </Link>

        <H4 fontWeight={700} mb="0.75rem">
          {formattedPrice}
        </H4>

        {normalizedRating !== null || normalizedReviews !== null ? (
          <FlexBox
            alignItems="center"
            justifyContent="center"
            style={{ gap: "0.35rem" }}>
            {normalizedRating !== null ? <Rating value={normalizedRating} color="warn" /> : null}
            {normalizedReviews !== null ? (
              <Small fontWeight={600} color="gray.500">
                ({normalizedReviews})
              </Small>
            ) : null}
          </FlexBox>
        ) : null}
      </Box>
    </Wrapper>
  );
}
