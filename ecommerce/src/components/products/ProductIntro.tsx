"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconMinus, IconPlus } from "@tabler/icons-react";

import Box from "@component/Box";
import Image from "@component/Image";
import Rating from "@component/rating";
import Avatar from "@component/avatar";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import { H1, H2, H3, H6, Paragraph, SemiSpan } from "@component/Typography";
import useCart from "@hook/useCart";
import { formatInventoryStatus, formatMoney } from "@/lib/utils/format";
import ProductWishlistButton from "@component/product-cards/ProductWishlistButton";

const fallbackCurrency = "USD";

// ========================================
interface Props {
  price: number;
  title: string;
  images: string[];
  id: string | number;
  currency?: string;
  basePrice?: number;
  discount?: number;
  rating?: number;
  ratingCount?: number;
  brand?: string;
  status?: string;
  shortDescription?: string;
}
// ========================================

export default function ProductIntro({
  images,
  title,
  price,
  id,
  currency,
  basePrice,
  discount,
  rating,
  ratingCount,
  brand,
  status,
  shortDescription
}: Props) {
  const param = useParams();
  const { state, dispatch } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);

  const routerId = param.slug as string;
  const cartItem = state.cart.find((item) => item.id === id || item.id === routerId);
  const productNumericId = useMemo(() => {
    if (typeof id === "number" && Number.isFinite(id)) return id;
    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [id]);

  const moneyConfig = useMemo(
    () => ({ amount: price, currency: currency ?? fallbackCurrency }),
    [price, currency]
  );

  const displayPrice = useMemo(() => formatMoney(moneyConfig), [moneyConfig]);

  const basePriceLabel = useMemo(() => {
    if (!basePrice || basePrice <= price) return null;
    return formatMoney({ amount: basePrice, currency: currency ?? fallbackCurrency });
  }, [basePrice, price, currency]);

  const formattedStatus = status ? formatInventoryStatus(status as any) : null;
  const productRating = rating ?? 4;
  const productRatingCount = ratingCount ?? 0;
  const productBrand = brand ?? "Store brand";

  const handleImageClick = useCallback((ind: number) => () => setSelectedImage(ind), []);

  const handleCartAmountChange = useCallback(
    (amount: number) => () => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: {
          id,
          price,
          qty: amount,
          name: title,
          imgUrl: images[0]
        }
      });
    },
    [dispatch, id, images, price, title]
  );

  return (
    <Box overflow="hidden">
      <Grid container justifyContent="center" alignItems="center" spacing={16}>
        <Grid item md={6} xs={12} alignItems="center">
          <div>
            <FlexBox mb="50px" overflow="hidden" borderRadius={16} justifyContent="center">
              <Image
                width={300}
                height={300}
                src={images[selectedImage]}
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </FlexBox>

            <FlexBox overflow="auto">
              {images.map((url, ind) => (
                <Box
                  key={ind}
                  size={70}
                  bg="white"
                  minWidth={70}
                  display="flex"
                  cursor="pointer"
                  border="1px solid"
                  borderRadius="10px"
                  alignItems="center"
                  justifyContent="center"
                  ml={ind === 0 ? "auto" : ""}
                  mr={ind === images.length - 1 ? "auto" : "10px"}
                  borderColor={selectedImage === ind ? "primary.main" : "gray.400"}
                  onClick={handleImageClick(ind)}>
                  <Avatar src={url} borderRadius="10px" size={65} />
                </Box>
              ))}
            </FlexBox>
          </div>
        </Grid>

        <Grid item md={6} xs={12} alignItems="center">
          <H1 mb="0.75rem">{title}</H1>

          {shortDescription ? (
            <Paragraph color="text.muted" mb="1rem">
              {shortDescription}
            </Paragraph>
          ) : null}

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>Brand:</SemiSpan>
            <H6 ml="8px">{productBrand}</H6>
          </FlexBox>

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>Rated:</SemiSpan>
            <Box ml="8px" mr="8px">
              <Rating color="warn" value={productRating} outof={5} />
            </Box>
            <H6>({productRatingCount})</H6>
          </FlexBox>

          <Box mb="24px">
            <H2 color="primary.main" mb="4px" lineHeight="1">
              {displayPrice}
            </H2>
            {basePriceLabel ? (
              <SemiSpan color="text.muted" style={{ textDecoration: "line-through" }}>
                {basePriceLabel}
              </SemiSpan>
            ) : null}
            {typeof discount === "number" && discount > 0 ? (
              <SemiSpan color="success.main" display="block" mt="0.25rem">
                Save {discount}%
              </SemiSpan>
            ) : null}
            <SemiSpan color="inherit" display="block" mt="0.35rem">
              {formattedStatus ?? "Available"}
            </SemiSpan>
          </Box>

          {!cartItem?.qty ? (
            <FlexBox alignItems="center" mb="36px" style={{ gap: "0.75rem" }}>
              <Button
                size="small"
                color="primary"
                variant="contained"
                onClick={handleCartAmountChange(1)}>
                Add to Cart
              </Button>

              <ProductWishlistButton productId={productNumericId} />
            </FlexBox>
          ) : (
            <FlexBox alignItems="center" mb="36px" style={{ gap: "0.75rem" }}>
              <Button
                p="9px"
                size="small"
                color="primary"
                variant="outlined"
                onClick={handleCartAmountChange(cartItem?.qty - 1)}>
                <IconMinus size={22} />
              </Button>

              <H3 fontWeight="600" mx="20px">
                {cartItem?.qty.toString().padStart(2, "0")}
              </H3>

              <Button
                p="9px"
                size="small"
                color="primary"
                variant="outlined"
                onClick={handleCartAmountChange(cartItem?.qty + 1)}>
                <IconPlus size={22} />
              </Button>

              <ProductWishlistButton productId={productNumericId} />
            </FlexBox>
          )}

          <FlexBox alignItems="center" mb="1rem">
            <SemiSpan>Sold By:</SemiSpan>
            <Link href="/shops/scarlett-beauty">
              <H6 lineHeight="1" ml="8px">
                Mobile Store
              </H6>
            </Link>
          </FlexBox>
        </Grid>
      </Grid>
    </Box>
  );
}
