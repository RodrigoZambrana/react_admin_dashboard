import { Fragment } from "react";

import api from "@utils/__api__/shops";
import Grid from "@component/grid/Grid";
import ProductFilterCard from "@component/products/ProductFilterCard";
import ShopIntroCard from "@sections/shop/ShopIntroCard";
import ProductDetails from "@sections/shop/ProductDetails";
import { SlugParams } from "interfaces";

export default async function ShopDetailsDemoPage({ params }: SlugParams) {
  const { slug } = await params;
  const shop = await api.getShopBySlug(slug);

  return (
    <Fragment>
      <ShopIntroCard />

      <Grid container spacing={6}>
        <Grid item md={3} xs={12}>
          <ProductFilterCard />
        </Grid>

        <Grid item md={9} xs={12}>
          <ProductDetails shop={shop} />
        </Grid>
      </Grid>
    </Fragment>
  );
}
