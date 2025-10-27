"use client";

import styled from "styled-components";

import { Carousel } from "components/carousel";
import { ProductCard15 } from "@component/product-cards";
import CategorySectionCreator from "@component/CategorySectionCreator";
import Product from "@models/product.model";
import Box from "@component/Box";

// STYLED COMPONENT
const Wrapper = styled("div")(({ theme }) => ({
  "& .carousel__slider": { paddingBottom: 10 },
  "& .carousel__next-button, .carousel__back-button": {
    padding: 10,
    borderRadius: 0,
    boxShadow: theme.shadows[2],
    color: theme.colors.marron.main,
    background: theme.colors.marron[50],
    "&:hover": { background: theme.colors.marron[100] }
  }
}));

// ===============================================
type Props = { products: Product[]; title: string };
// ===============================================

const responsive = [
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default function Section5({ products, title }: Props) {
  return (
    <CategorySectionCreator title={title} seeMoreLink="#">
      <Wrapper>
        <Carousel slidesToShow={4} responsive={responsive}>
          {products.map((item) => (
            <Box pb=".5rem">
              <ProductCard15
                id={item.id}
                key={item.id}
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
      </Wrapper>
    </CategorySectionCreator>
  );
}
