"use client";

import Link from "next/link";
import { Fragment, useCallback } from "react";
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
import ProductQuickActions from "./ProductQuickActions";

import { calculateDiscount, currency } from "@utils/utils";
import { deviceSize } from "@utils/constants";

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
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
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
  imgUrl: string;
  rating: number;
  images: string[];
  id?: string | number;
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
  ...props
}: ProductCard1Props) {
  const { state, dispatch } = useCart();
  const cartItem = state.cart.find((item) => item.id === id);

  const handleCartAmountChange = useCallback(
    (amount: number) => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: {
          id,
          slug,
          price,
          imgUrl,
          name: title,
          qty: amount
        }
      });
    },
    [dispatch, id, slug, price, imgUrl, title]
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
              {off}% off
            </Chip>
          )}

          <ProductQuickActions
            className="extra-icons overlay-actions"
            compact
            productId={id}
            productSlug={slug}
            productTitle={title}
            productPrice={price}
            productImages={images}
            productImage={imgUrl}
            onAddToCart={() => handleCartAmountChange((cartItem?.qty || 0) + 1)}
          />

          <Link href={`/product/${slug}`}>
            <NextImage alt={title} width={277} src={imgUrl} height={270} />
          </Link>
        </div>

        <div className="details">
          <FlexBox>
            <Box flex="1 1 0" minWidth="0px" mr="0.5rem">
              <Link href={`/product/${slug}`}>
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
                  {calculateDiscount(price, off as number)}
                </SemiSpan>

                {!!off && (
                  <SemiSpan color="text.muted" fontWeight="600">
                    <del>{currency(price)}</del>
                  </SemiSpan>
                )}
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
