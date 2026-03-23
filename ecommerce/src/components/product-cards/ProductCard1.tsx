"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo } from "react";
import styled from "styled-components";
import { IconPlus, IconMinus } from "@tabler/icons-react";

import useCart from "@hook/useCart";

import Box from "@component/Box";
import Rating from "@component/rating";
import Chip from "@component/Chip";
import FlexBox from "@component/FlexBox";
import NextImage from "@component/NextImage";
import Card, { CardProps } from "@component/Card";
import { H3, SemiSpan } from "@component/Typography";
import { Button } from "@component/buttons";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { filterValidProductImages, isMissingProductImage } from "@/lib/utils/image";
import { StorefrontApi } from "@/lib/api/storefront";
import {
  buildPublishedParametricDetailHref,
  buildPublishedParametricLineId,
  buildPublishedParametricSummaryEntries
} from "@/lib/storefront/published-parametric";
import ProductQuickActions from "./ProductQuickActions";
import { deviceSize } from "@utils/constants";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { useTranslation } from "@/state/i18n-context";
import type { ProductMode } from "@/types/storefront";

// STYLED COMPONENT
const Wrapper = styled(Card)`
  margin: auto;
  height: 100%;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  justify-content: space-between;
  transition: all 250ms ease-in-out;

  &:hover {
    .details {
      .add-cart {
        display: flex;
      }
    }
    .image-holder {
      .extra-icons {
        opacity: 1;
        pointer-events: auto;
        transform: none;
      }
    }
  }

  .image-holder {
    text-align: center;
    position: relative;
    display: inline-block;
    height: 100%;

    .extra-icons {
      z-index: 2;
      top: 0.75rem;
      right: 0.75rem;
      cursor: pointer;
      position: absolute;
      flex-direction: column;
      gap: 0.25rem;
      opacity: 0;
      pointer-events: none;
      transform: translateY(-4px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    @media only screen and (max-width: ${deviceSize.sm}px) {
      display: block;
      .extra-icons {
        opacity: 1;
        pointer-events: auto;
        transform: none;
      }
    }
  }

  .details {
    padding: 1rem;

    .title,
    .categories {
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .title {
      min-height: 2.8em;
      line-height: 1.4;
    }

    .icon-holder {
      display: flex;
      align-items: flex-end;
      flex-direction: column;
      justify-content: space-between;
    }

    .favorite-icon {
      cursor: pointer;
    }
    .outlined-icon {
      svg path {
        fill: ${({ theme }) => theme.colors.text.hint};
      }
    }
    .add-cart {
      display: none;
      margin-top: auto;
      align-items: center;
      flex-direction: column;
    }
  }

  @media only screen and (max-width: 768px) {
    .details {
      .add-cart {
        display: flex;
      }
    }
    .image-holder .extra-icons {
      opacity: 1;
      pointer-events: auto;
      transform: none;
    }
  }
`;

// =======================================================================
interface ProductCard1Props extends CardProps {
  off?: number;
  slug: string;
  title: string;
  price: number;
  imgUrl?: string | null;
  rating: number;
  images?: string[];
  id?: string | number;
  basePrice?: number;
  currencyCode?: string;
  mode?: ProductMode;
  variantKey?: string | null;
  variantLabel?: string | null;
  configuration?: Record<string, unknown> | null;
}
// =======================================================================

export default function ProductCard1({
  id,
  off,
  slug,
  title,
  price,
  imgUrl,
  images,
  rating = 4,
  basePrice,
  currencyCode,
  mode,
  variantKey,
  variantLabel,
  configuration,
  ...props
}: ProductCard1Props) {
  const t = useTranslation();
  const { state, dispatch } = useCart();
  const { formatAmount, baseCurrency } = useMoneyFormatter();
  const cartProductId =
    mode === "parametric" && variantKey
      ? buildPublishedParametricLineId(id ?? slug ?? "product", variantKey)
      : id ?? slug;
  const cartItem = state.cart.find((item) => item.id === cartProductId);

  const primaryImage = useMemo(() => {
    if (typeof imgUrl !== "string") return undefined;
    const trimmed = imgUrl.trim();
    return trimmed && !isMissingProductImage(trimmed) ? trimmed : undefined;
  }, [imgUrl]);

  const gallery = useMemo(
    () => filterValidProductImages([primaryImage, ...(images ?? [])]),
    [images, primaryImage]
  );

  const resolvedCurrency = currencyCode ?? baseCurrency;
  const productCurrency = currencyCode ?? baseCurrency;
  const hasExplicitBasePrice =
    typeof basePrice === "number" && Number.isFinite(basePrice) && basePrice > 0 && basePrice > price;
  const hasDiscountPercentage = typeof off === "number" && Number.isFinite(off) && off > 0;
  const baselineAmount = hasExplicitBasePrice ? basePrice! : price;
  const computedSaleAmount = hasExplicitBasePrice
    ? price
    : hasDiscountPercentage
      ? baselineAmount - baselineAmount * ((off as number) / 100)
      : price;
  const saleAmount = Number.isFinite(computedSaleAmount)
    ? Math.max(0, computedSaleAmount)
    : price;
  const effectivePrice = saleAmount;
  const showListPrice = hasExplicitBasePrice || hasDiscountPercentage;
  const formattedSalePrice = formatAmount(saleAmount, resolvedCurrency);
  const formattedListPrice = showListPrice ? formatAmount(baselineAmount, resolvedCurrency) : null;
  const detailHref =
    mode === "parametric" && slug
      ? buildPublishedParametricDetailHref(slug, configuration ?? undefined)
      : `/product/${slug}`;

  const handleCartAmountChange = useCallback(
    async (amount: number) => {
      let resolvedConfiguration = configuration ?? undefined;
      let resolvedSelectionSummary = variantLabel ?? null;

      if (mode === "parametric" && (!resolvedConfiguration || !resolvedSelectionSummary) && slug) {
        try {
          const detail = await StorefrontApi.getProduct(slug);
          const defaultConfiguration = detail.publishedParametricOptions?.defaultConfiguration;
          const defaultSummary = defaultConfiguration
            ? buildPublishedParametricSummaryEntries(defaultConfiguration, t, {
                includeMaterial: false
              })
                .map((entry) => `${entry.attribute}: ${entry.value}`)
                .join(" • ")
            : null;

          resolvedConfiguration = defaultConfiguration ?? resolvedConfiguration;
          resolvedSelectionSummary = defaultSummary || detail.variantLabel || resolvedSelectionSummary;
        } catch (error) {
          console.warn("[shop-card] Unable to hydrate parametric summary before add to cart", error);
        }
      }

      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: {
          id: cartProductId,
          slug,
          price: effectivePrice,
          currency: productCurrency,
        imgUrl: primaryImage,
        name: title,
        qty: amount,
        variantLabel: resolvedSelectionSummary,
        selectionSummary: resolvedSelectionSummary,
        configuration: resolvedConfiguration
      }
    });
  },
    [
      configuration,
      dispatch,
      cartProductId,
      slug,
      effectivePrice,
      mode,
      primaryImage,
      productCurrency,
      t,
      title,
      variantLabel
    ]
  );

  return (
    <Fragment>
      <Wrapper borderRadius={12} {...props}>
        <div className="image-holder">
          {!!off && (
            <Chip
              top="10px"
              left="10px"
              p="5px 10px"
              fontSize="10px"
              fontWeight="600"
              bg="primary.main"
              position="absolute"
              color="primary.text"
              zIndex={1}>
              {t("product.discount.percentOff", {
                defaultMessage: "{discount}% off",
                values: { discount: off }
              })}
            </Chip>
          )}

          <ProductQuickActions
            className="extra-icons overlay-actions"
            compact
            productId={id}
          productSlug={slug}
          productTitle={title}
          productPrice={effectivePrice}
          productBasePrice={showListPrice ? baselineAmount : undefined}
          productCurrency={productCurrency}
          productImages={gallery}
          productImage={primaryImage}
          onAddToCart={() => handleCartAmountChange((cartItem?.qty || 0) + 1)}
        />

          <Link href={detailHref}>
            {primaryImage ? (
              <NextImage alt={title} width={277} src={primaryImage} height={270} />
            ) : (
              <NoImagePlaceholder width={277} height={270} />
            )}
          </Link>
        </div>

        <div className="details">
          <FlexBox>
            <Box flex="1 1 0" minWidth="0px" mr="0.5rem">
              <Link href={detailHref}>
                <H3
                  mb="10px"
                  title={title}
                  fontSize="14px"
                  textAlign="left"
                  fontWeight="600"
                  className="title"
                  color="text.secondary">
                  {title}
                </H3>
              </Link>

              <Rating value={rating || 0} outof={5} color="warn" readOnly />

              <FlexBox alignItems="center" mt="10px">
                <SemiSpan pr="0.5rem" fontWeight="600" color="primary.main">
                  {formattedSalePrice}
                </SemiSpan>

                {showListPrice && formattedListPrice ? (
                  <SemiSpan color="text.muted" fontWeight="600">
                    <del>{formattedListPrice}</del>
                  </SemiSpan>
                ) : null}
              </FlexBox>
            </Box>

            <FlexBox
              width="30px"
              alignItems="center"
              flexDirection="column-reverse"
              justifyContent={!!cartItem?.qty ? "space-between" : "flex-start"}>
              <Button
                size="none"
                padding="3px"
                color="primary"
                variant="outlined"
                borderColor="primary.light"
                onClick={() => handleCartAmountChange((cartItem?.qty || 0) + 1)}>
                <IconPlus size={18} />
              </Button>

              {!!cartItem?.qty && (
                <Fragment>
                  <SemiSpan color="text.primary" fontWeight="600">
                    {cartItem.qty}
                  </SemiSpan>

                  <Button
                    size="none"
                    padding="3px"
                    color="primary"
                    variant="outlined"
                    borderColor="primary.light"
                    onClick={() => handleCartAmountChange(cartItem.qty - 1)}>
                    <IconMinus size={18} />
                  </Button>
                </Fragment>
              )}
            </FlexBox>
          </FlexBox>
        </div>
      </Wrapper>

    </Fragment>
  );
}
