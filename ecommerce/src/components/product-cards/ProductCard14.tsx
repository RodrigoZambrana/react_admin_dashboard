"use client";

import { useCallback, useMemo } from "react";
import styled from "styled-components";

import LazyImage from "components/LazyImage";
import { H6, Paragraph } from "components/Typography";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";

// STYLED COMPONENTS
const StyledCard = styled("div")(({ theme }) => ({
  textAlign: "center",
  transition: "all 0.3s",
  "& .overlay-actions": {
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 0.2s ease"
  },
  "&:hover": {
    "& h6": { color: theme.colors.marron.main },
    "& .overlay-actions": {
      opacity: 1,
      pointerEvents: "auto"
    }
  },
  "@media (hover: none)": {
    "& .overlay-actions": {
      opacity: 1,
      pointerEvents: "auto"
    }
  }
}));

const ImgBox = styled("div")(({ theme }) => ({
  position: "relative",
  padding: "0 40px 20px 40px",
  background: theme.colors.marron[100]
}));

// ===================================================
type Props = {
  title: string;
  imgUrl: string;
  available: string;
  id?: number | string;
  slug?: string;
  price?: number;
};
// ===================================================

export default function ProductCard14({ imgUrl, title, available, id, slug, price }: Props) {
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
    <StyledCard>
      <ImgBox>
        <ProductQuickActions
          className="overlay-actions"
          compact
          style={{ position: "absolute", top: 16, right: 16 }}
          productId={id}
          productSlug={fallbackSlug}
          productTitle={title}
          productPrice={fallbackPrice}
          productImage={imgUrl}
          onAddToCart={handleAddToCart}
        />
        <LazyImage
          src={imgUrl}
          width={256}
          height={166}
          style={{ width: "100%", objectFit: "contain" }}
          alt="bonik"
        />
      </ImgBox>

      <H6 fontSize={15} mt="8px" mb="2px">
        {title}
      </H6>

      <Paragraph color="gray.600">{available}</Paragraph>
    </StyledCard>
  );
}
