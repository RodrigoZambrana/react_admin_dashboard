import Box from "@component/Box";
import Grid from "@component/grid/Grid";

import CheckoutForm from "@sections/checkout/CheckoutForm";

import CheckoutCostSummary from "@/components/cart/CheckoutCostSummary";
import AdditionalCommentsPanel from "./AdditionalCommentsPanel";

export const metadata = {
  title: "Checkout details · Storefront"
};

export default function CheckoutDetailsPage() {
  return (
    <Grid container flexWrap="wrap-reverse" spacing={6}>
      <Grid item lg={8} md={8} xs={12}>
        <CheckoutForm />
      </Grid>

      <Grid item lg={4} md={4} xs={12}>
        <Box display="flex" flexDirection="column">
          <CheckoutCostSummary actionHref={null} />
          <AdditionalCommentsPanel />
        </Box>
      </Grid>
    </Grid>
  );
}
