"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo, useState } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Card from "@component/Card";
import Chip from "@component/Chip";
import Rating from "@component/rating";
import Icon from "@component/icon/Icon";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import LazyImage from "@component/LazyImage";
import { H3, Paragraph, Span } from "@component/Typography";
import ProductQuickView from "@component/products/ProductQuickView";
import useCart from "@hook/useCart";
import ProductQuickActions from "./ProductQuickActions";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { filterValidProductImages, isMissingProductImage } from "@/lib/utils/image";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";

// STYLED COMPONENTS
const StyledBazaarCard = styled(Card)(({ theme }) => ({
  margin: "auto",
  height: "100%",
  display: "flex",
  overflow: "hidden",
  position: "relative",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "all 250ms ease-in-out",
  borderRadius: "0px 10px 10px 10px",
  "&:hover": {
    boxShadow: theme.shadows[2],
    "& .controller": { right: 10 }
  }
}));

const ImageWrapper = styled(Box)({
  textAlign: "center",
  position: "relative",
  display: "inline-block"
});

const ImageBox = styled(Box)(({ theme }) => ({
  padding: "44px 40px",
  borderBottom: `1px solid ${theme.colors.gray[300]}`
}));

const HoverWrapper = styled(FlexBox)(({ theme }) => ({
  top: 0,
  bottom: 0,
  width: 34,
  right: -30,
  height: 120,
  margin: "auto",
  overflow: "hidden",
  borderRadius: "5px",
  background: "#fff",
  alignItems: "center",
  position: "absolute",
  flexDirection: "column",
  boxShadow: theme.shadows[2],
  justifyContent: "space-between",
  transition: "right 0.3s ease-in-out",
  "& svg": { fontSize: 18, color: theme.colors.gray[600] },
  "& span": {
    width: "100%",
    height: "100%",
    display: "flex",
    padding: "10px 0px",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": { cursor: "pointer", background: "#f3f5f9" }
  },
  "& a": {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": { cursor: "pointer", background: "#f3f5f9" }
  },
  ".overlay-actions": {
    opacity: 0,
    pointerEvents: "none",
    transform: "translateY(-4px)",
    transition: "opacity 0.2s ease, transform 0.2s ease"
  }
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  zIndex: 11,
  top: "16px",
  left: "0px",
  color: "white",
  fontWeight: 600,
  fontSize: "11px",
  padding: "3px 12px",
  position: "absolute",
  borderRadius: "0px 50px 50px 0px",
  background: theme.colors.primary.main
}));

const ContentWrapper = styled(Box)({
  padding: "1rem",
  "& .title, & .categories": {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }
});

const ButtonBox = styled(FlexBox)(({ theme }) => ({
  gap: 10,
  marginTop: "15px",
  justifyContent: "space-between",
  "& button": {
    color: "#fff",
    background: theme.colors.primary.main,
    "&:hover": { background: theme.colors.primary[400] }
  },
  "& button svg path": { fill: "white !important" }
}));

// =============================================================
type ProductCardProps = {
  off: number;
  slug: string;
  title: string;
  price: number;
  imgUrl?: string | null;
  rating?: number;
  images?: string[];
  id: string | number;
  hoverEffect?: boolean;
  basePrice?: number;
  currencyCode?: string;
};
// =============================================================

export default function ProductCard16(props: ProductCardProps) {
  const {
    off,
    id,
    title,
    price,
    imgUrl,
    rating,
    hoverEffect,
    slug,
    images = [],
    basePrice,
    currencyCode
  } = props;

  const { state, dispatch } = useCart();
  const { formatAmount, baseCurrency } = useMoneyFormatter();
  const [openModal, setOpenModal] = useState(false);

  const cartItem = state.cart.find((item) => item.id === id);
  const primaryImage = useMemo(() => {
    if (typeof imgUrl !== "string") return undefined;
    const trimmed = imgUrl.trim();
    return trimmed && !isMissingProductImage(trimmed) ? trimmed : undefined;
  }, [imgUrl]);

  const gallery = useMemo(
    () => filterValidProductImages([primaryImage, ...(images ?? [])]),
    [images, primaryImage]
  );

  const toggleDialog = useCallback(() => setOpenModal((open) => !open), []);

  const resolvedCurrency = currencyCode ?? baseCurrency;
  const hasExplicitBasePrice =
    typeof basePrice === "number" && Number.isFinite(basePrice) && basePrice > 0 && basePrice > price;
  const hasDiscountPercentage = typeof off === "number" && Number.isFinite(off) && off > 0;
  const baselineAmount = hasExplicitBasePrice ? basePrice! : price;
  const computedSaleAmount = hasExplicitBasePrice
    ? price
    : hasDiscountPercentage
      ? baselineAmount - baselineAmount * (off / 100)
      : price;
  const saleAmount = Number.isFinite(computedSaleAmount)
    ? Math.max(0, computedSaleAmount)
    : price;
  const showListPrice = hasExplicitBasePrice || hasDiscountPercentage;
  const formattedSalePrice = formatAmount(saleAmount, resolvedCurrency);
  const formattedListPrice = showListPrice ? formatAmount(baselineAmount, resolvedCurrency) : null;

  const handleCartAmountChange = (qty: number) => () => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: { price: saleAmount, imgUrl: primaryImage, id, qty, slug, name: title }
    });
  };

  return (
    <StyledBazaarCard hoverEffect={hoverEffect}>
      <ImageWrapper>
        {off !== 0 && <StyledChip color="primary">{`${off}% off`}</StyledChip>}

        <ImageBox>
          <Link href={`/product/${slug}`}>
            {primaryImage ? (
              <LazyImage
                alt={title}
                src={primaryImage}
                width={190}
                height={190}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <NoImagePlaceholder
                width="100%"
                height="190px"
                text="No image available"
                borderRadius={0}
              />
            )}
          </Link>

          <HoverWrapper className="controller">
            <ProductQuickActions
              compact
          direction="column"
          productId={id}
          productSlug={slug}
          productTitle={title}
          productPrice={saleAmount}
          productBasePrice={showListPrice ? baselineAmount : undefined}
          productCurrency={resolvedCurrency}
          productImages={gallery}
          productImage={primaryImage}
          onAddToCart={() => handleCartAmountChange((cartItem?.qty || 0) + 1)()}
          disableOverlay
        />

            <Divider />

            <Span onClick={handleCartAmountChange(1)}>
              <Icon variant="small">shopping-cart</Icon>
            </Span>
          </HoverWrapper>
        </ImageBox>

        <ProductQuickActions
          compact
          style={{ position: "absolute", top: 16, right: 16 }}
          productId={id}
          productSlug={slug}
          productTitle={title}
          productPrice={saleAmount}
          productBasePrice={showListPrice ? baselineAmount : undefined}
          productCurrency={resolvedCurrency}
          productImages={gallery}
          productImage={primaryImage}
          onAddToCart={() => handleCartAmountChange((cartItem?.qty || 0) + 1)()}
          disableOverlay
        />
      </ImageWrapper>

      <ProductQuickView
        open={openModal}
        onClose={toggleDialog}
        product={{
          id,
          images: gallery,
          slug,
          price: saleAmount,
          basePrice: showListPrice ? baselineAmount : undefined,
          currency: resolvedCurrency,
          title
        }}
      />

      <ContentWrapper>
        <Box flex="1 1 0" minWidth="0px" mr={1}>
          <Link href={`/product/${slug}`}>
            <H3
              mb={1}
              title={title}
              fontSize="14px"
              fontWeight="600"
              className="title"
              color="text.secondary">
              {title}
            </H3>
          </Link>

          {rating && (
            <FlexBox alignItems="center">
              <Rating value={rating || 0} color="warn" />
              <Paragraph ml={2}>{`(${rating}.0)`}</Paragraph>
            </FlexBox>
          )}

          <FlexBox alignItems="center" mt={1}>
            <Box fontWeight="600" color="primary.main" mr={1}>
              {formattedSalePrice}
            </Box>

            {showListPrice && formattedListPrice ? (
              <Box color="grey.600" fontWeight="600">
                <del>{formattedListPrice}</del>
              </Box>
            ) : null}
          </FlexBox>
        </Box>

        <ButtonBox>
          <Button
            variant="contained"
            onClick={handleCartAmountChange(cartItem?.qty ? cartItem.qty - 1 : 1)}
            style={{
              paddingTop: "3px",
              paddingBottom: "3px",
              width: "100%",
              fontSize: "13px"
            }}>
            {cartItem?.qty ? (
              <Fragment>
                <Icon size="16px">minus</Icon> Remove from Cart
              </Fragment>
            ) : (
              <Fragment>
                <Icon size="16px">plus</Icon> Add to Cart
              </Fragment>
            )}
          </Button>

          <Button variant="contained" style={{ padding: "4px 12px" }}>
            <Icon size="16px">heart</Icon>
          </Button>
        </ButtonBox>
      </ContentWrapper>
    </StyledBazaarCard>
  );
}
