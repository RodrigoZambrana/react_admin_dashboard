"use client";

import Box from "@component/Box";
import { Carousel } from "@component/carousel";
import { H1, Paragraph } from "@component/Typography";
import { ProductCard13 } from "@component/product-cards";
import Product from "@models/product.model";

// =====================================================
interface Props {
  title: string;
  products: Product[];
}
// =====================================================

const responsive = [
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default function Section3({ products, title }: Props) {
  return (
    <Box mt={5}>
      <Box mb={4}>
        <H1 mb="4px">{title}</H1>
        <Paragraph color="grey.600">Tall blind but were, been folks not the expand</Paragraph>
      </Box>

      <Box my="-0.25rem">
        <Carousel responsive={responsive} slidesToShow={3}>
          {products.map((item, ind) => (
            <Box py="0.25rem" key={ind}>
              <ProductCard13
                id={item.id}
                slug={item.slug}
                title={item.title}
                price={item.price}
                off={item.discount}
                status={item.status}
                rating={item.rating}
                imgUrl={item.thumbnail}
                productColors={item.colors}
              />
            </Box>
          ))}
        </Carousel>
      </Box>
    </Box>
  );
}
