"use client";

import styled from "styled-components";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import { H2 } from "@component/Typography";
import { ProductCard1 } from "@component/product-cards";
import Product from "@models/product.model";

// STYLED COMPONENT
const GridOne = styled(Grid)({
  ".image-holder > a > span": {
    height: "100% !important"
  }
});

const product = {
  id: "56b18419-a114-4d73-8725-48fa10823479",
  slug: "smart-watch-black",
  title: "Smart watch black",
  rating: 4,
  price: 250,
  discount: 25,
  reviews: [],
  thumbnail: "/assets/images/products/long-product.png",
  images: ["/assets/images/products/long-product.png", "/assets/images/products/long-product.png"]
};

// ==========================================================
type Props = { products: Product[] };
// ==========================================================

export default function Section7({ products }: Props) {
  return (
    <Box mb="3.75rem">
      <H2 mb="1.5rem">Trending Items</H2>

      <Grid container spacing={6}>
        <GridOne item md={3} xs={12}>
          <ProductCard1
            id={product.title}
            slug={product.slug}
            title={product.title}
            price={product.price}
            off={product.discount}
            rating={product.rating}
            images={product.images}
            imgUrl={product.thumbnail}
          />
        </GridOne>

        <Grid item md={9} xs={12}>
          <Grid container spacing={6}>
            {products.map((item, ind) => (
              <Grid item lg={4} sm={6} xs={12} key={item.id}>
                <ProductCard1
                  id={item.id}
                  off={ind * 10}
                  slug={item.slug}
                  title={item.title}
                  price={item.price}
                  rating={item.rating}
                  images={item.images}
                  imgUrl={item.thumbnail}
                />
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
