"use client";

import type { PropsWithChildren } from "react";

import Box from "@component/Box";
import Container from "@component/Container";
import ShopLayout from "@component/layout/layout-1";

import CheckoutStepper from "@component/checkout/CheckoutStepper";

export default function CheckoutFlowLayout({ children }: PropsWithChildren) {
  return (
    <ShopLayout>
      <Container my="3rem">
        <CheckoutStepper />
        <Box mt="2rem">{children}</Box>
      </Container>
    </ShopLayout>
  );
}

