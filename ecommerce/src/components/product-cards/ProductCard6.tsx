"use client";

import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Card from "@component/Card";
import Chip from "@component/Chip";
import NextImage from "@component/NextImage";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";

// ===========================================================================
type ProductCard6Props = {
  title: string;
  imgUrl: string;
  subtitle: string;
  id?: number | string;
  slug?: string;
  price?: number;
};
// ===========================================================================

const OverlayCard = styled(Card)(({ theme }) => ({
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

const ProductCard6 = ({ title, subtitle, imgUrl, id, slug, price }: ProductCard6Props) => {
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
    <OverlayCard position="relative" padding="1rem" borderRadius={8}>
      <Chip
        zIndex={2}
        p="4px 10px"
        color="white"
        top="1.5rem"
        left="1.5rem"
        fontSize="10px"
        fontWeight="600"
        bg="secondary.main"
        position="absolute">
        {title}
      </Chip>

      <Chip
        zIndex={2}
        p="4px 10px"
        bg="gray.300"
        top="1.5rem"
        right="1.5rem"
        fontSize="10px"
        color="gray.800"
        fontWeight="600"
        position="absolute">
        {subtitle}
      </Chip>

      <Box borderRadius={8} display="flex" overflow="hidden">
        <NextImage src={imgUrl} width={345} height={120} alt="bonik" />
      </Box>

      <ProductQuickActions
        compact
        className="overlay-actions"
        style={{ position: "absolute", bottom: 16, right: 16 }}
        productId={id}
        productSlug={fallbackSlug}
        productTitle={title}
        productPrice={fallbackPrice}
        productImage={imgUrl}
        onAddToCart={handleAddToCart}
      />
    </OverlayCard>
  );
};

export default ProductCard6;
