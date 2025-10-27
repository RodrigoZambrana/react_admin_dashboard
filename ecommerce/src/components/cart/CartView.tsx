"use client";

import { Fragment } from "react";
import Link from "next/link";
import styled from "styled-components";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react";
import { SpaceProps, space } from "styled-system";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import { Card1 } from "@component/Card1";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import TextField from "@component/text-field";
import Select from "@component/Select";
import Typography, { Paragraph } from "@component/Typography";
import { Button, IconButton } from "@component/buttons";
import LazyImage from "@component/LazyImage";
import countryList from "@data/countryList";
import { isValidProp } from "@utils/utils";

import { type CartLineItem, useStorefrontCart } from "@/state/cart-context";
import { formatMoney, normalizeMoney } from "@/lib/utils/format";
import CheckoutCostSummary from "./CheckoutCostSummary";

// Feature flag to re-enable voucher and shipping estimators when backend is ready.
const SHOW_VOUCHER_AND_SHIPPING = false;

type CartLineItemCardProps = SpaceProps & {
  item: CartLineItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

const CartLineItemWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => isValidProp(prop)
})<SpaceProps>`
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

function CartLineItemCard({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  ...rest
}: CartLineItemCardProps) {
  const unitPrice = normalizeMoney(item.product.salePrice ?? item.product.price);
  const lineTotal = normalizeMoney({
    amount: unitPrice.amount * item.quantity,
    currency: unitPrice.currency
  });

  const thumbnailSrc = item.product.thumbnail?.url || "/assets/images/products/iphone-xi.png";

  return (
    <CartLineItemWrapper {...rest}>
      <LazyImage alt={item.product.name} width={140} height={140} src={thumbnailSrc} />

      <FlexBox
        width="100%"
        minWidth="0px"
        flexDirection="column"
        className="product-details"
        justifyContent="space-between">
        <Link href={`/product/${item.product.slug}`}>
          <Typography className="title" fontWeight="500" fontSize="18px" mb="0.5rem">
            {item.product.name}
          </Typography>
        </Link>

        <Box position="absolute" right="1rem" top="1rem">
          <IconButton color="gray.600" padding="4px" ml="12px" onClick={onRemove}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <FlexBox justifyContent="space-between" alignItems="flex-end">
          <FlexBox flexWrap="wrap" alignItems="center">
            <Typography color="gray.600" mr="0.5rem">
              {formatMoney(unitPrice)} x {item.quantity}
            </Typography>

            <Typography fontWeight={600} color="primary.main" mr="1rem">
              = {formatMoney(lineTotal)}
            </Typography>
          </FlexBox>

          <FlexBox alignItems="center" style={{ gap: "0.5rem" }}>
            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              disabled={item.quantity === 1}
              borderColor="primary.light"
              onClick={onDecrease}>
              <IconMinus size={16} />
            </Button>

            <Typography mx="0.5rem" fontWeight="600" fontSize="15px">
              {item.quantity}
            </Typography>

            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              borderColor="primary.light"
              onClick={onIncrease}>
              <IconPlus size={16} />
            </Button>
          </FlexBox>
        </FlexBox>
      </FlexBox>
    </CartLineItemWrapper>
  );
}

export function CartView() {
  const { state, updateQuantity, removeItem, subtotal } = useStorefrontCart();

  if (state.items.length === 0) {
    return (
      <Card1>
        <FlexBox
          alignItems="center"
          flexDirection="column"
          justifyContent="center"
          height="320px">
          <Paragraph mt="1rem" color="text.muted" textAlign="center" maxWidth="260px">
            Your shopping bag is empty. Start shopping
          </Paragraph>
          <Button mt="1.5rem" variant="contained" color="primary" href="/shop">
            Continue Shopping
          </Button>
        </FlexBox>
      </Card1>
    );
  }

  return (
    <Fragment>
      <Grid container spacing={6}>
        <Grid item lg={8} md={8} xs={12}>
          {state.items.map((item) => (
            <CartLineItemCard
              key={item.product.id}
              item={item}
              mb="1.5rem"
              onDecrease={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
              onIncrease={() => updateQuantity(item.product.id, item.quantity + 1)}
              onRemove={() => removeItem(item.product.id)}
            />
          ))}
        </Grid>

        <Grid item lg={4} md={4} xs={12}>
          <CheckoutCostSummary />

          {SHOW_VOUCHER_AND_SHIPPING && (
            <Card1 mt="1.5rem">
              <TextField placeholder="Voucher" fullWidth />

              <Button variant="outlined" color="primary" mt="1rem" mb="30px" fullWidth>
                Apply Voucher
              </Button>

              <Divider mb="1.5rem" />

              <Typography fontWeight="600" mb="1rem">
                Shipping Estimates
              </Typography>

              <Select
                mb="1rem"
                label="Country"
                options={countryList}
                placeholder="Select Country"
                onChange={(e) => console.log(e)}
              />

              <Select
                label="State"
                options={stateList}
                placeholder="Select State"
                onChange={(e) => console.log(e)}
              />

              <Box mt="1rem">
                <TextField label="Zip Code" placeholder="3100" fullWidth />
              </Box>

              <Button variant="outlined" color="primary" my="1rem" fullWidth>
                Calculate Shipping
              </Button>
            </Card1>
          )}
        </Grid>
      </Grid>
    </Fragment>
  );
}

const stateList = [
  { value: "New York", label: "New York" },
  { value: "Chicago", label: "Chicago" }
];
