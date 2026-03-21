import { Fragment } from "react";
// GLOBAL CUSTOM COMPONENTS
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Pagination from "@component/pagination";
import ShopCard1 from "@sections/shop/ShopCard1";
import { Card1 } from "@component/Card1";
import Typography, { H2, SemiSpan } from "@component/Typography";
// API FUNCTIONS
import api from "@utils/__api__/shops";
import shopsFallback from "@/__server__/__db__/shop/data";
import { shopsRecoverySnapshot } from "@/__server__/snapshots/recovery-data";
import type Shop from "models/shop.model";

const RUNTIME_ENV = process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV ?? "development";
const IS_LOCAL_ENV = RUNTIME_ENV === "local" || RUNTIME_ENV === "development";
const RECOVERY_MODE_ENABLED = process.env.NEXT_PUBLIC_RECOVERY_MODE === "snapshot";
const ALLOW_LOCAL_SHOP_MOCKS =
  process.env.NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS === "true" ||
  process.env.ENABLE_STOREFRONT_FALLBACKS === "true";

async function getShopListWithFallback(): Promise<Shop[]> {
  try {
    const shops = await api.getShopList();
    return Array.isArray(shops) ? shops : [];
  } catch (error) {
    console.warn("[shops] Failed to load shop list.");
    console.debug(error);

    if (RECOVERY_MODE_ENABLED) {
      if (shopsRecoverySnapshot && shopsRecoverySnapshot.length > 0) {
        console.warn("[shops] Using recovery snapshot for shop list.");
        return shopsRecoverySnapshot;
      }

      console.warn(
        "[shops] Recovery mode enabled but no snapshot provided. Returning empty shop list."
      );
      return [];
    }

    if (!IS_LOCAL_ENV) {
      if (process.env.NEXT_PUBLIC_SHOP_LIST_FAIL_FAST === "true") {
        console.error(
          "[shops] No recovery data available. Failing fast because NEXT_PUBLIC_SHOP_LIST_FAIL_FAST=true."
        );
        throw error;
      }

      console.error(
        "[shops] No recovery data available. Returning empty list to avoid exposing mock data."
      );
      return [];
    }

    if (ALLOW_LOCAL_SHOP_MOCKS) {
      console.warn(`[shops] Using local mock fallback (NEXT_PUBLIC_ENV=${RUNTIME_ENV}).`);
      return shopsFallback as Shop[];
    }

    console.warn("[shops] Local mock fallback disabled. Returning empty list.");
    return [];
  }
}

export default async function ShopList() {
  const shopList = await getShopListWithFallback();
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
            We couldn&rsquo;t load the shop directory right now. Please refresh the page or try
            again later.
          </Typography>
        </Card1>
      )}
    </Fragment>
  );
}
