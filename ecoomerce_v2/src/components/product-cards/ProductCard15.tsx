"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import styled from "styled-components";
import { IconEye, IconHeart, IconShoppingCart } from "@tabler/icons-react";

import Rating from "@component/rating";
import Chip from "@component/Chip";
import FlexBox from "@component/FlexBox";
import LazyImage from "@component/LazyImage";
import { H3, Paragraph, Span } from "@component/Typography";
import ProductQuickView from "@component/products/ProductQuickView";
import { calculateDiscount, currency } from "@utils/utils";
import useCart from "@hook/useCart";

// STYLED COMPONENTS
const StyledCard = styled("div")(({ theme }) => ({
  height: "100%",
  margin: "auto",
  borderRadius: 0,
  overflow: "hidden",
  position: "relative",
  transition: "all 250ms ease-in-out",
  "&:hover": {
    boxShadow: theme.shadows[6],
    "& .controlBox": { display: "flex", bottom: 0 }
  }
}));

const ImgBox = styled("div")(({ theme }) => ({
  height: "200px",
  overflow: "hidden",
  position: "relative",
  padding: "0 40px 20px 40px",
  background: theme.colors.marron[100],
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}));

const ItemController = styled("div")(({ theme }) => ({
  width: 35,
  right: 15,
  height: 120,
  bottom: -120,
  display: "flex",
  overflow: "hidden",
  background: "#fff",
  position: "absolute",
  flexDirection: "column",
  transition: "bottom 0.3s ease-in-out",
  "& svg": { fontSize: 18, color: theme.colors.gray[600] },
  "& span": {
    width: "100%",
    height: "100%",
    display: "flex",
    padding: "8px 10px",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": {
      cursor: "pointer",
      background: theme.colors.marron.main,
      "& svg": { color: "#fff" }
    }
  }
}));

const ContentWrapper = styled("div")({
  padding: "1rem",
  "& .title, & .categories": {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }
});

const StyledChip = styled(Chip)(({ theme }) => ({
  zIndex: 11,
  top: "16px",
  left: "0px",
  color: "white",
  borderRadius: 0,
  fontWeight: 600,
  fontSize: "10px",
  padding: "3px 7px",
  position: "absolute",
  background: theme.colors.marron.main
}));

// ============================================================
interface Props {
  off: number;
  slug: string;
  title: string;
  price: number;
  imgUrl: string;
  rating?: number;
  images: string[];
  id: string | number;
}
// ============================================================

export default function ProductCard15({
  id,
  off,
  slug,
  title,
  price,
  imgUrl,
  rating,
  images
}: Props) {
  const [open, setOpen] = useState(false);
  const { state, dispatch } = useCart();

  const cartItem = state.cart.find((item) => item.slug === slug);

  const toggleDialog = useCallback(() => setOpen((open) => !open), []);

  const handleAddToCart = useCallback(() => {
    const payload = {
      id,
      slug,
      price,
      imgUrl,
      name: title,
      qty: (cartItem?.qty || 0) + 1
    };

    dispatch({ type: "CHANGE_CART_AMOUNT", payload });
  }, [dispatch, id, imgUrl, price, slug, cartItem?.qty, title]);

  return (
    <StyledCard>
      <ImgBox id="imgBox">
        {off !== 0 && <StyledChip color="primary">{off}% off</StyledChip>}

        <Link href={`/product/${slug}`}>
          <LazyImage
            src={imgUrl}
            width={200}
            height={200}
            alt="bonik"
            style={{
              width: "100%",
              height: "auto",
              objectFit: "contain"
            }}
          />
        </Link>

        <ItemController className="controlBox">
          <Span onClick={toggleDialog}>
            <IconEye size={18} />
          </Span>

          <Span>
            <IconHeart size={18} />
          </Span>

          <Span onClick={handleAddToCart}>
            <IconShoppingCart size={18} />
          </Span>
        </ItemController>
      </ImgBox>

      <ProductQuickView
        open={open}
        onClose={toggleDialog}
        product={{ id, slug, images, price, title }}
      />

      <ContentWrapper>
        <FlexBox justifyContent="center">
          <Paragraph pr={2} fontWeight="600" color="marron.main">
            {calculateDiscount(price, off)}
          </Paragraph>

          {off !== 0 && (
            <Paragraph color="gray.600" fontWeight="600">
              <del>{currency(price)}</del>
            </Paragraph>
          )}
        </FlexBox>

        <Link href={`/product/${slug}`}>
          <H3
            my=".5rem"
            title={title}
            fontSize="15px"
            fontWeight="600"
            className="title"
            textAlign="center"
            color="text.secondary">
            {title}
          </H3>
        </Link>

        {rating && (
          <FlexBox alignItems="center" justifyContent="center">
            <Rating value={rating || 0} color="warn" />{" "}
            <Paragraph ml={2} lineHeight={1} color="gray.600">{`(${rating}.0)`}</Paragraph>
          </FlexBox>
        )}
      </ContentWrapper>
    </StyledCard>
  );
}
