import Box from "@component/Box";
import { H2, Paragraph } from "@component/Typography";

import { CartView } from "@/components/cart/CartView";

export const metadata = {
  title: "Your cart · Storefront"
};

export default function CartPage() {
  return (
    <Box>
      <Box mb="2rem">
        <H2 fontWeight={600} mb="0.5rem">
          Your Cart
        </H2>
        <Paragraph color="text.muted" maxWidth="520px">
          Items in your cart are reserved for a limited time. Complete checkout to confirm inventory
          allocation.
        </Paragraph>
      </Box>

      <CartView />
    </Box>
  );
}
