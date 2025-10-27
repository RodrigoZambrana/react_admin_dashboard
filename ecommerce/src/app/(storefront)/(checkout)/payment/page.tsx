import Grid from "@component/grid/Grid";

import PaymentForm from "@sections/payment/PaymentForm";

import CheckoutCostSummary from "@/components/cart/CheckoutCostSummary";

export const metadata = {
  title: "Payment · Storefront"
};

export default function PaymentPage() {
  return (
    <Grid container flexWrap="wrap-reverse" spacing={6}>
      <Grid item lg={8} md={8} xs={12}>
        <PaymentForm />
      </Grid>

      <Grid item lg={4} md={4} xs={12}>
        <CheckoutCostSummary actionHref={null} />
      </Grid>
    </Grid>
  );
}

