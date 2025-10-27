import Box from "@component/Box";
import { H2, Paragraph } from "@component/Typography";

import CheckoutCostSummary from "@/components/cart/CheckoutCostSummary";

export const metadata = {
  title: "Review · Storefront"
};

export default function ReviewPage() {
  return (
    <Box>
      <Box mb="2rem">
        <H2 fontWeight={600} mb="0.5rem">
          Review your order
        </H2>
        <Paragraph color="text.muted" maxWidth="520px">
          Confirm your shipping information and totals. You can return to prior steps if any detail
          needs to be updated.
        </Paragraph>
      </Box>

      <CheckoutCostSummary actionLabel="Back to Cart" actionHref="/cart" />
    </Box>
  );
}

