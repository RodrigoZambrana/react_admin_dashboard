"use client";

import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import HoverBox from "@component/HoverBox";
import { H4 } from "@component/Typography";
import NextImage from "@component/NextImage";
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

// ====================================================================
type ProductCard5Props = {
  imgUrl: string;
  title: string;
  id?: number | string;
  slug?: string;
  price?: number;
};
// ====================================================================

export default function ProductCard5({ imgUrl, title, id, slug, price }: ProductCard5Props) {
  const fallbackSlug = slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const fallbackPrice = typeof price === "number" ? price : 0;
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
        price: fallbackPrice,
        imgUrl,
        name: title
      }
    });
  }, [dispatch, resolvedId, cartItem?.qty, fallbackSlug, fallbackPrice, imgUrl, title]);

  return (
    <Wrapper>
      <Box position="relative" mb="0.5rem">
        <HoverBox borderRadius={5} display="flex">
          <NextImage alt={title} src={imgUrl} width={260} height={175} />
        </HoverBox>

        <ProductQuickActions
          compact
          className="overlay-actions"
          style={{ position: "absolute", top: 12, right: 12 }}
          productId={id}
          productSlug={fallbackSlug}
          productTitle={title}
          productPrice={fallbackPrice}
          productImage={imgUrl}
          onAddToCart={handleAddToCart}
        />
      </Box>

      <H4 fontSize="14px" fontWeight="600">
        {title}
      </H4>
    </Wrapper>
  );
}
