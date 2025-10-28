"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import HoverBox from "@component/HoverBox";
import { H4 } from "@component/Typography";
import NextImage from "@component/NextImage";
import { currency } from "@utils/utils";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";

const CardWrapper = styled(Box)(({ theme }) => ({
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

// ========================================================
interface ProductCard2Props {
  slug: string;
  title: string;
  price: number;
  imgUrl: string;
  id?: number | string;
}
// ========================================================

export default function ProductCard2({ imgUrl, title, price, slug, id }: ProductCard2Props) {
  const { state, dispatch } = useCart();
  const resolvedId = useMemo(() => id ?? slug ?? title, [id, slug, title]);
  const cartItem = state.cart.find((item) => String(item.id) === String(resolvedId));

  const handleAddToCart = useCallback(() => {
    if (!resolvedId) return;
    const nextQty = (cartItem?.qty ?? 0) + 1;
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: {
        id: resolvedId,
        qty: nextQty,
        slug,
        price,
        imgUrl,
        name: title
      }
    });
  }, [dispatch, resolvedId, cartItem?.qty, slug, price, imgUrl, title]);

  return (
    <CardWrapper>
      <Box position="relative" mb="0.5rem">
        <Link href={`/product/${slug}`}>
          <HoverBox borderRadius={8} display="flex">
            <NextImage src={imgUrl} width={181} height={181} alt={title} />
          </HoverBox>
        </Link>

        <ProductQuickActions
          compact
          className="overlay-actions"
          style={{ position: "absolute", top: 12, right: 12 }}
          productId={id}
          productSlug={slug}
          productTitle={title}
          productPrice={price}
          productImage={imgUrl}
          onAddToCart={handleAddToCart}
        />
      </Box>

      <Link href={`/product/${slug}`}>
        <H4 fontWeight="600" fontSize="14px" mb="0.25rem">
          {title}
        </H4>
      </Link>

      <H4 fontWeight="600" fontSize="14px" color="primary.main">
        {currency(price)}
      </H4>
    </CardWrapper>
  );
}
