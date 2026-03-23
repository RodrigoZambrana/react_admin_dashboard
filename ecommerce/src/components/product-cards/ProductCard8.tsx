"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Card from "@component/Card";
import FlexBox from "@component/FlexBox";
import HoverBox from "@component/HoverBox";
import NextImage from "@component/NextImage";
import { H6, SemiSpan } from "@component/Typography";
import { calculateDiscount, currency } from "@utils/utils";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";

const StyledCard = styled(Card)(({ theme }) => ({
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

// ==============================================================
type ProductCard8Props = {
  id: string;
  off: number;
  slug: string;
  price: number;
  title: string;
  imgUrl: string;
  [key: string]: unknown;
};
// ==============================================================

export default function ProductCard8({
  id,
  off,
  slug,
  price,
  title,
  imgUrl,
  ...props
}: ProductCard8Props) {
  const { state, dispatch } = useCart();
  const resolvedId = useMemo(() => Number(id) || id || slug || title, [id, slug, title]);
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
    <StyledCard p="1rem" borderRadius={12} position="relative" {...props}>
      <ProductQuickActions
        compact
        className="overlay-actions"
        style={{ position: "absolute", top: 16, right: 16 }}
        productId={id}
        productSlug={slug}
        productTitle={title}
        productPrice={price}
        productImage={imgUrl}
        onAddToCart={handleAddToCart}
      />

      <Link href={`/product/${slug}`}>
        <HoverBox mb="0.75rem" borderRadius={8} overflow="hidden">
          <NextImage
            src={imgUrl || "/assets/images/products/Rectangle 116.png"}
            width={500}
            height={500}
            alt="bonik"
          />
        </HoverBox>

        <SemiSpan
          title={title}
          mb="0.25rem"
          color="inherit"
          display="block"
          style={{ whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere", minHeight: "2.8em" }}>
          {title}
        </SemiSpan>

        <FlexBox alignItems="center">
          <H6 color="primary.main" mr="0.25rem">
            {calculateDiscount(price, off)}
          </H6>

          <SemiSpan>
            <del>{currency(price)}</del>
          </SemiSpan>
        </FlexBox>
      </Link>
    </StyledCard>
  );
}
