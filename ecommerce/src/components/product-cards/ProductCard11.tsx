"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Rating from "@component/rating";
import FlexBox from "@component/FlexBox";
import NextImage from "@component/NextImage";
import { H6, SemiSpan, Small } from "@component/Typography";
import { calculateDiscount, currency } from "@utils/utils";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";

// STYLED COMPONENT
const StyledProductCard = styled.div`
  .image-holder {
    position: relative;
    :after {
      content: " ";
      position: absolute;
      transition: all 250ms ease-in-out;
    }
  }
  .ellipsis {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &:hover {
    .image-holder:after {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.07);
    }
    .overlay-actions {
      opacity: 1;
      pointer-events: auto;
      transform: none;
    }
  }

  .overlay-actions {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  @media (hover: none) {
    .overlay-actions {
      opacity: 1;
      pointer-events: auto;
      transform: none;
    }
  }
`;

// ===================================================
type ProductCard11Props = {
  slug: string;
  off?: number;
  title: string;
  price: number;
  imgUrl: string;
  rating?: number;
  id?: number | string;
};
// ===================================================

export default function ProductCard11(props: ProductCard11Props) {
  const { title, imgUrl, price, rating, slug, off = 0, id } = props;
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
    <StyledProductCard>
      <Box mb="1rem" className="image-holder">
        <Link href={`/product/${slug}`}>
          <NextImage src={imgUrl} width={150} height={150} alt="bonik" />
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

      <Box mb="0.5rem">
        <Rating value={rating} outof={5} color="warn" readOnly />
      </Box>

      <Link href={`/product/${slug}`}>
        <H6 className="ellipsis" mb="6px" title={title}>
          {title}
        </H6>
      </Link>

      <FlexBox alignItems="center">
        <SemiSpan pr="0.3rem" fontWeight="600" color="primary.main" lineHeight="1">
          {calculateDiscount(price, off)}
        </SemiSpan>

        {!!off && (
          <Small color="text.muted" lineHeight="1">
            <del>{currency(price, 0)}</del>
          </Small>
        )}
      </FlexBox>
    </StyledProductCard>
  );
}
