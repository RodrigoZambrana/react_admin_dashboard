"use client";

import Box from "@component/Box";
import { Carousel } from "@component/carousel";
import { ProductCard10 } from "@component/product-cards";
import CategorySectionCreator from "@component/CategorySectionCreator";
import Product from "@models/product.model";
// STYLED COMPONENT
import { SubTitle } from "./styles";

// =====================================================
type Props = { title: string; products: Product[] };
// =====================================================

const responsive = [
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default function Section3({ title, products }: Props) {
  return (
    <CategorySectionCreator title={title} seeMoreLink="#">
      <SubTitle>Best collection in 2021 for you!</SubTitle>

      <Box my="-0.25rem">
        <Carousel responsive={responsive} slidesToShow={3}>
          {products.map((item, ind) => (
            <Box py="0.25rem" key={ind}>
              <ProductCard10
                id={item.id}
                slug={item.slug}
                unit={item.unit}
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
    </CategorySectionCreator>
  );
}
