import type { Metadata } from "next";
import Box from "@component/Box";
import Grid from "@component/grid/Grid";

import CheckoutForm from "@sections/checkout/CheckoutForm";

import CheckoutCostSummary from "@/components/cart/CheckoutCostSummary";
import { StorefrontApi } from "@/lib/api/storefront";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import AdditionalCommentsPanel from "./AdditionalCommentsPanel";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Checkout",
    description: "Completa los datos de contacto y entrega para finalizar tu compra."
  });
}

export default async function CheckoutDetailsPage() {
  const initialShippingOptions = await StorefrontApi.listShippingOptions().catch(() => []);

  return (
    <Grid container flexWrap="wrap-reverse" spacing={6}>
      <Grid item lg={8} md={8} xs={12}>
        <CheckoutForm initialShippingOptions={initialShippingOptions} />
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
