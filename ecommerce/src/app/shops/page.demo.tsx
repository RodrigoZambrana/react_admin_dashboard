import { Fragment } from "react";

import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Pagination from "@component/pagination";
import ShopCard1 from "@sections/shop/ShopCard1";
import { Card1 } from "@component/Card1";
import Typography, { H2, SemiSpan } from "@component/Typography";
import api from "@utils/__api__/shops";
import type Shop from "models/shop.model";

async function getShopList(): Promise<Shop[]> {
  try {
    const shops = await api.getShopList();
    return Array.isArray(shops) ? shops : [];
  } catch (error) {
    console.warn("[shops] Failed to load shop list. Returning empty list.", error);
    return [];
  }
}

export default async function ShopListDemoPage() {
  const shopList = await getShopList();
  const hasShops = shopList.length > 0;

  return (
    <Fragment>
      <H2 mb="24px">All Shops</H2>

      {hasShops ? (
        <Fragment>
          <Grid container spacing={6}>
            {shopList.map((item) => (
              <Grid item lg={4} sm={6} xs={12} key={item.id}>
                <ShopCard1
                  name={item.name}
                  phone={item.phone}
                  address={item.address}
                  rating={item.rating || 5}
                  imgUrl={item.profilePicture}
                  coverImgUrl={item.coverPicture}
                  shopUrl={`/shops/${item.slug}`}
                />
              </Grid>
            ))}
          </Grid>

          <FlexBox flexWrap="wrap" justifyContent="space-between" alignItems="center" mt="32px">
            <SemiSpan>Showing 1-9 of {shopList.length} Shops</SemiSpan>
            <Pagination pageCount={Math.ceil(shopList.length / 9)} />
          </FlexBox>
        </Fragment>
      ) : (
        <Card1 borderRadius={12} p="2rem">
          <Typography fontWeight="600" mb="0.5rem">
            Shop data unavailable
          </Typography>
          <Typography color="text.muted">
            We couldn&apos;t load the shop directory right now. Please refresh the page or try
            again later.
          </Typography>
        </Card1>
      )}
    </Fragment>
  );
}
