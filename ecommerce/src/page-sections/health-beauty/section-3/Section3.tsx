"use client";

import Box from "@component/Box";
import { Carousel } from "@component/carousel";
import { ProductCard16 } from "@component/product-cards";
import CategorySectionCreator from "@component/CategorySectionCreator";
import Product from "@models/product.model";
// STYLED COMPONENT
import { SubTitle } from "./styles";

// =====================================================
type Props = { title: string; products: Product[] };
// =====================================================

export default function Section3({ title, products }: Props) {
  const responsive = [
    { breakpoint: 950, settings: { slidesToShow: 3 } },
    { breakpoint: 650, settings: { slidesToShow: 2 } },
    { breakpoint: 500, settings: { slidesToShow: 1 } }
  ];

  return (
    <CategorySectionCreator title={title} seeMoreLink="#">
      <SubTitle>Best collection in 2021 for you!</SubTitle>

      <div>
        <Carousel slidesToShow={3} responsive={responsive}>
          {products.map((item) => (
            <Box py="0.25rem" key={item.id}>
              <ProductCard16
                id={item.id}
                slug={item.slug}
                title={item.title}
                price={item.price}
                off={item.discount}
                rating={item.rating}
                imgUrl={item.thumbnail}
                images={item.images as string[]}
              />
            </Box>
          ))}
        </Carousel>
      </div>
    </CategorySectionCreator>
  );
}
