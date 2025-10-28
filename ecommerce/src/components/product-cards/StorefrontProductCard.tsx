"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Rating from "@component/rating";
import NextImage from "@component/NextImage";
import { H4, Paragraph, Small } from "@component/Typography";
import useCart from "@hook/useCart";
import { currency } from "@utils/utils";
import ProductQuickActions from "./ProductQuickActions";

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
  imgUrl: string;
  images?: string[];
  category?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  currencyCode?: string;
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
  currencyCode
}: StorefrontProductCardProps) {
  const { state, dispatch } = useCart();

  const cartItem = state.cart.find((item) => item.id === id || item.slug === slug);
  const gallery = useMemo(() => {
    if (Array.isArray(images) && images.length > 0) return images;
    return [imgUrl];
  }, [images, imgUrl]);

  const handleAddToCart = useCallback(() => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: {
        id,
        slug,
        price,
        imgUrl,
        name: title,
        qty: (cartItem?.qty ?? 0) + 1
      }
    });
  }, [cartItem?.qty, dispatch, id, imgUrl, price, slug, title]);

  const normalizedRating = typeof rating === "number" ? rating : null;
  const normalizedReviews = typeof reviewCount === "number" ? reviewCount : null;

  return (
    <Wrapper>
      <Media>
        <Link href={`/product/${slug}`}>
          <NextImage
            width={300}
            height={300}
            alt={title}
            src={imgUrl}
            style={{ width: "100%", height: "auto", objectFit: "cover" }}
          />
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
          productImages={gallery}
          productImage={imgUrl}
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
          {currencyCode ? `${currencyCode} ${price.toFixed(2)}` : currency(price)}
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
