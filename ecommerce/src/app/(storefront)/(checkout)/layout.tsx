"use client";

import type { PropsWithChildren } from "react";

import Box from "@component/Box";
import Container from "@component/Container";
import ShopLayout from "@component/layout/layout-1";

import CheckoutStepper from "@component/checkout/CheckoutStepper";
import { StorefrontCheckoutProvider } from "@/state/checkout-context";

export default function CheckoutFlowLayout({ children }: PropsWithChildren) {
  return (
    <ShopLayout>
      <StorefrontCheckoutProvider>
        <Container my="3rem">
          <CheckoutStepper />
          <Box mt="2rem">{children}</Box>
        </Container>
      </StorefrontCheckoutProvider>
    </ShopLayout>
  );
}
