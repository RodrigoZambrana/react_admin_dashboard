"use client";

import Link from "next/link";
import { useCallback } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Image from "@component/Image";
import Rating from "@component/rating";
import NavLink from "@component/nav-link";
import { Paragraph } from "@component/Typography";
import { currency } from "@utils/utils";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";

// STYLED COMPONENT
const StyledFlexBox = styled("div")({
  gap: "1rem",
  display: "flex",
  position: "relative",
  marginBottom: "1rem",
  alignItems: "center",
  "& a": { flexShrink: 0 },
  "& img": { transition: "0.3s" },
  "&:last-of-type": { marginBottom: 0 },
  "&:hover": {
    img: { transform: "scale(1.1)" },
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

// ===========================================
type ProductCard18Props = {
  slug: string;
  image: string;
  title: string;
  price: number;
  rating: number;
  id?: number | string;
};
// ===========================================

export default function ProductCard18({ image, title, price, slug, rating, id }: ProductCard18Props) {
  const { state, dispatch } = useCart();
  const cartItem = state.cart.find((item) => String(item.id) === String(id ?? slug ?? title));

  const handleAddToCart = useCallback(() => {
    const nextQty = (cartItem?.qty ?? 0) + 1;
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: {
        id: id ?? slug ?? title,
        qty: nextQty,
        slug,
        price,
        imgUrl: image,
        name: title
      }
    });
  }, [dispatch, cartItem?.qty, id, slug, title, price, image]);

  return (
    <StyledFlexBox>
      <ProductQuickActions
        compact
        className="overlay-actions"
        style={{ position: "absolute", top: 8, right: 8 }}
        productId={id ?? slug ?? title}
        productSlug={slug}
        productTitle={title}
        productPrice={price}
        productImage={image}
        onAddToCart={handleAddToCart}
      />

      <Link href={`/product/${slug}`}>
        <Box maxWidth={100} bg="gray.300">
          <Image width="100%" alt="product" src={image} />
        </Box>
      </Link>

      <div>
        <NavLink href="#">
          <Paragraph fontSize={16}>{title}</Paragraph>
        </NavLink>

        <Paragraph fontWeight={700} my={1}>
          {currency(price)}
        </Paragraph>

        <Rating value={rating} size="small" color="warn" />
      </div>
    </StyledFlexBox>
  );
}
