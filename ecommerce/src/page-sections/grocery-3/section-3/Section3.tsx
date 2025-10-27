"use client";

import Box from "@component/Box";
import { H1 } from "@component/Typography";
import { Carousel } from "@component/carousel";
import { ProductCard12 } from "@component/product-cards";
import Product from "@models/product.model";
// STYLED COMPONENT
import { TitleBox } from "./styles";

// =====================================================
type Props = { products: Product[] };
// =====================================================

const responsive = [
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default function Section3({ products }: Props) {
  return (
    <div>
      <TitleBox>
        <H1>Top Saled Products</H1>
        <div />
      </TitleBox>

      <Box my="-0.25rem">
        <Carousel responsive={responsive} slidesToShow={3}>
          {products.map((item) => (
            <Box py="0.25rem" key={item.id}>
              <ProductCard12
                id={item.id}
                slug={item.slug}
                title={item.title}
                price={item.price}
                off={item.discount}
                rating={item.rating}
                images={item.images}
                imgUrl={item.thumbnail}
              />
            </Box>
          ))}
        </Carousel>
      </Box>
    </div>
  );
}
