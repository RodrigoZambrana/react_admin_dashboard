"use client";

import Box from "@component/Box";
import Avatar from "@component/avatar";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import Typography, { H6 } from "@component/Typography";

import type { CheckoutLineItem } from "@/types/storefront";

export default function WriteReview({ item }: { item: CheckoutLineItem }) {
  const price = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: item.price.currency
  }).format(item.price.amount);

  return (
    <FlexBox px="1rem" py="0.5rem" flexWrap="wrap" alignItems="center" key={`${item.productId}-${item.name}`}>
      <FlexBox flex="2 2 260px" m="6px" alignItems="center">
        <Avatar src={item.image ?? "/assets/images/products/placeholder.png"} size={64} />

        <Box ml="20px">
          <H6 my="0px">{item.name ?? `Item ${item.productId}`}</H6>
          <Typography fontSize="14px" color="text.muted">
            {price} × {item.quantity}
          </Typography>
        </Box>
      </FlexBox>

      <FlexBox flex="1 1 260px" m="6px" alignItems="center">
        <Typography fontSize="14px" color="text.muted">
          Product properties: Black, L
        </Typography>
      </FlexBox>

      <FlexBox flex="160px" m="6px" alignItems="center">
        <Button variant="text" color="primary">
          <Typography fontSize="14px">Write a Review</Typography>
        </Button>
      </FlexBox>
    </FlexBox>
  );
}
