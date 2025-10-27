"use client";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import { H2 } from "@component/Typography";
import { Carousel } from "@component/carousel";
import { ProductCard11 } from "@component/product-cards";
import CategorySectionCreator from "@component/CategorySectionCreator";
import { Card1, Card4 } from "../showcase-cards";
import Product from "@models/product.model";

// =================================================================
interface Props {
  topPickList: Product[];
  mainCarousel: Product[];
}
// =================================================================

const responsive = [
  { breakpoint: 1100, settings: { slidesToShow: 3 } },
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default function Section1({ topPickList, mainCarousel }: Props) {
  return (
    <CategorySectionCreator>
      <Grid container spacing={6}>
        {/* INTRODUCE NEW WINTER CAROUSEL AREA */}
        <Grid item md={5} xs={12}>
          <Carousel slidesToShow={1}>
            {mainCarousel.map((item) => (
              <Card1
                key={item.id}
                title={item.title}
                price={item.price}
                imgUrl={item.thumbnail}
                discount={item.discount}
              />
            ))}
          </Carousel>
        </Grid>

        <Grid item md={7} xs={12}>
          {/* TOP PICKS PRODUCTS CAROUSEL AREA */}
          <Box mb="3rem">
            <H2 mb="1.5rem">Top Picks</H2>

            <Carousel responsive={responsive} slidesToShow={4}>
              {topPickList.map((item) => (
                <ProductCard11
                  key={item.id}
                  slug={item.slug}
                  price={item.price}
                  title={item.title}
                  off={item.discount}
                  rating={item.rating}
                  imgUrl={item.thumbnail}
                />
              ))}
            </Carousel>
          </Box>

          {/* CONVERSE COLLECTION BANNER AREA */}
          <Card4 />

          {/* CAROUSEL PRODUCTS AREA */}
          <Carousel responsive={responsive} slidesToShow={4}>
            {topPickList.map((item) => (
              <ProductCard11
                key={item.id}
                slug={item.slug}
                price={item.price}
                title={item.title}
                off={item.discount}
                rating={item.rating}
                imgUrl={item.thumbnail}
              />
            ))}
          </Carousel>
        </Grid>
      </Grid>
    </CategorySectionCreator>
  );
}
