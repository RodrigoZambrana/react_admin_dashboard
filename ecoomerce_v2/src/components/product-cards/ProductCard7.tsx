"use client";

import Link from "next/link";
import styled from "styled-components";
import { space, SpaceProps } from "styled-system";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react";

import useCart from "@hook/useCart";
import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import LazyImage from "@component/LazyImage";
import Typography from "@component/Typography";
import { IconButton } from "@component/buttons";

import { currency, isValidProp } from "@utils/utils";

// STYLED COMPONENTS
const Wrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => isValidProp(prop)
})`
  display: flex;
  overflow: hidden;
  position: relative;
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.small};
  background-color: ${({ theme }) => theme.colors.body.paper};

  .product-details {
    padding: 20px;
  }
  .title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  @media only screen and (max-width: 425px) {
    flex-wrap: wrap;
    img {
      height: auto;
      min-width: 100%;
    }
  }
  ${space}
`;

// =====================================================================
interface ProductCard7Props extends SpaceProps {
  qty: number;
  name: string;
  slug: string;
  price: number;
  imgUrl?: string;
  id: string | number;
}
// =====================================================================

export default function ProductCard7({
  id,
  qty,
  name,
  slug,
  price,
  imgUrl,
  ...others
}: ProductCard7Props) {
  const { dispatch } = useCart();

  const handleCartAmountChange = (amount: number) => () => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: { qty: amount, name, price, imgUrl, id }
    });
  };

  return (
    <Wrapper {...others}>
      <LazyImage
        alt={name}
        width={140}
        height={140}
        src={imgUrl || "/assets/images/products/iphone-xi.png"}
      />

      <FlexBox
        width="100%"
        minWidth="0px"
        flexDirection="column"
        className="product-details"
        justifyContent="space-between">
        <Link href={`/product/${slug}`}>
          <Typography className="title" fontWeight="500" fontSize="18px" mb="0.5rem">
            {name}
          </Typography>
        </Link>

        <Box position="absolute" right="1rem" top="1rem">
          <IconButton color="gray.600" padding="4px" ml="12px" onClick={handleCartAmountChange(0)}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <FlexBox justifyContent="space-between" alignItems="flex-end">
          <FlexBox flexWrap="wrap" alignItems="center">
            <Typography color="gray.600" mr="0.5rem">
              {currency(price)} x {qty}
            </Typography>

            <Typography fontWeight={600} color="primary.main" mr="1rem">
              = {currency(price * qty)}
            </Typography>
          </FlexBox>

          <FlexBox alignItems="center" style={{ gap: "0.5rem" }}>
            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              disabled={qty === 1}
              borderColor="primary.light"
              onClick={handleCartAmountChange(qty - 1)}>
              <IconMinus size={16} />
            </Button>

            <Typography mx="0.5rem" fontWeight="600" fontSize="15px">
              {qty}
            </Typography>

            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              borderColor="primary.light"
              onClick={handleCartAmountChange(qty + 1)}>
              <IconPlus size={16} />
            </Button>
          </FlexBox>
        </FlexBox>
      </FlexBox>
    </Wrapper>
  );
}
