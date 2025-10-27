"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";
import { IconHeart, IconHeartFilled, IconShoppingCart } from "@tabler/icons-react";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Rating from "@component/rating";
import NextImage from "@component/NextImage";
import { Button, IconButton } from "@component/buttons";
import { H4, Paragraph, Small } from "@component/Typography";
import ProductQuickView from "@component/products/ProductQuickView";
import useCart from "@hook/useCart";
import { currency } from "@utils/utils";

const Wrapper = styled(Box)({
  position: "relative",
  "&:hover": {
    "& .product-actions": { right: 12 },
    "& img": { transform: "scale(1.05)" },
    "& .product-view-action": { opacity: 1, transform: "translateY(0)" }
  }
});

const Media = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  borderRadius: "8px",
  backgroundColor: theme.colors.gray[200],
  "& img": { transition: "transform 0.35s ease" }
}));

const FloatingIconButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  right: -40,
  top: 12,
  transition: "right 0.35s ease",
  backgroundColor: theme.colors.body.paper,
  boxShadow: theme.shadows.small,
  "&:hover": {
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.gray[0]
  }
}));

const FavoriteButton = styled(FloatingIconButton)({
  top: 56
});

const QuickViewButton = styled(Button)(({ theme }) => ({
  position: "absolute",
  left: 8,
  right: 8,
  bottom: 8,
  opacity: 0,
  transform: "translateY(12px)",
  transition: "all 0.3s ease",
  color: theme.colors.gray[0],
  backgroundColor: theme.colors.secondary.main,
  borderRadius: "6px"
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
  const [openQuickView, setOpenQuickView] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

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

  const handleToggleFavorite = useCallback(() => setIsFavorite((fav) => !fav), []);
  const toggleQuickView = useCallback(() => setOpenQuickView((open) => !open), []);

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

        <FloatingIconButton className="product-actions" onClick={handleAddToCart}>
          <IconShoppingCart size={18} />
        </FloatingIconButton>

        <FavoriteButton className="product-actions" onClick={handleToggleFavorite}>
          {isFavorite ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
        </FavoriteButton>

        <QuickViewButton
          size="small"
          variant="contained"
          className="product-view-action"
          onClick={toggleQuickView}>
          Quick View
        </QuickViewButton>
      </Media>

      <ProductQuickView
        open={openQuickView}
        onClose={toggleQuickView}
        product={{ id, images: gallery, slug, price, title }}
      />

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
