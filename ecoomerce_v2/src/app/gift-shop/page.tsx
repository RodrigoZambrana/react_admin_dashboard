import { Fragment } from "react";
// API FUNCTIONS
import api from "@utils/__api__/gift";
// GLOBAL CUSTOM COMPONENTS
import Container from "@component/Container";
// PAGE SECTION COMPONENTS
import Section1 from "@sections/gift-shop/section-1";
import Section2 from "@sections/gift-shop/section-2";
import Section3 from "@sections/gift-shop/section-3";
import Section4 from "@sections/gift-shop/section-4";
import Section5 from "@sections/gift-shop/section-5";
import Section6 from "@sections/gift-shop/section-6";
import ContentBox from "@sections/gift-shop/content-box";

export default async function GiftShop() {
  const popularProducts = await api.getPopularProducts();
  const topSailedProducts = await api.getTopSailedProducts();
  const categoryNavigation = await api.getCategoryNavigation();

  return (
    <Fragment>
      {/* HERO CAROUSEL AREA */}
      <Section1 />

      <Container>
        <ContentBox categoryNavigation={categoryNavigation}>
          {/* SERVICES AREA */}
          <Section2 />

          {/* DISCOUNT BANNER AREA */}
          <Section3 />

          {/* TOP CATEGORIES AREA */}
          <Section4 />
        </ContentBox>

        {/* POPULAR PRODUCTS AREA */}
        <Section5 products={popularProducts} title="Popular Items" />

        {/* TOP SALE PRODUCTS AREA */}
        <Section5 products={topSailedProducts} title="Top Sale Items" />

        {/* ALL PRODUCTS AREA */}
        <Section6 />
      </Container>
    </Fragment>
  );
}
