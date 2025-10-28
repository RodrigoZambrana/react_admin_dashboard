"use client";

import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Rating from "@component/rating";
import FlexBox from "@component/FlexBox";
import HoverBox from "@component/HoverBox";
import NextImage from "@component/NextImage";
import { H4, Small } from "@component/Typography";
import { currency } from "@utils/utils";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";

const Wrapper = styled.div(({ theme }) => ({
  position: "relative",
  "&:hover .overlay-actions": {
    opacity: 1,
    pointerEvents: "auto",
    transform: "none"
  },
  "@media (hover: none)": {
    ".overlay-actions": {
      opacity: 1,
      pointerEvents: "auto",
      transform: "none"
    }
  }
}));

// =======================================================
type ProductCard4Props = {
  title: string;
  price: number;
  rating: number;
  imgUrl: string;
  reviewCount: number;
  id?: number | string;
  slug?: string;
};
// =======================================================

export default function ProductCard4(props: ProductCard4Props) {
  const { imgUrl, rating, title, price, reviewCount, id, slug } = props;
  const fallbackSlug = slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { state, dispatch } = useCart();
  const resolvedId = useMemo(() => id ?? fallbackSlug, [id, fallbackSlug]);
  const cartItem = state.cart.find((item) => String(item.id) === String(resolvedId));

  const handleAddToCart = useCallback(() => {
    if (!resolvedId) return;
    const nextQty = (cartItem?.qty ?? 0) + 1;
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: {
        id: resolvedId,
        qty: nextQty,
        slug: fallbackSlug,
        price,
        imgUrl,
        name: title
      }
    });
  }, [dispatch, resolvedId, cartItem?.qty, fallbackSlug, price, imgUrl, title]);

  return (
    <Wrapper>
      <Box position="relative" mb="1rem" mx="auto" width="max-content">
        <HoverBox mx="auto" borderRadius={8} display="flex">
          <NextImage src={imgUrl} width={100} height={100} alt={title} />
        </HoverBox>

        <ProductQuickActions
          compact
          className="overlay-actions"
          style={{ position: "absolute", top: 12, right: 12 }}
          productId={id}
          productSlug={fallbackSlug}
          productTitle={title}
          productPrice={price}
          productImage={imgUrl}
          onAddToCart={handleAddToCart}
        />
      </Box>

      <FlexBox justifyContent="center" alignItems="center" mb="0.25rem">
        <Rating value={rating} color="warn" size="small" />

        <Small fontWeight="600" pl="0.25rem">
          ({reviewCount})
        </Small>
      </FlexBox>

      <H4 fontWeight="600" fontSize="14px" textAlign="center" mb="0.25rem" title={title} ellipsis>
        {title}
      </H4>

      <H4 fontWeight="600" fontSize="14px" textAlign="center" color="primary.main">
        {currency(price)}
      </H4>
    </Wrapper>
  );
}
