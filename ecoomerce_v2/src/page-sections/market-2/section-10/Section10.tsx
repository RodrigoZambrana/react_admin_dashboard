"use client";

import { useCallback, useState } from "react";

import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import Container from "@component/Container";
import { H2, Paragraph } from "@component/Typography";
import { ProductCard19 } from "@component/product-cards";
import { Carousel } from "@component/carousel";
import Product from "@models/product.model";
// STYLED COMPONENT
import { ButtonsWrapper } from "./styles";

// ======================================================================
type Section10Props = { products: Product[] };
// ======================================================================

export default function Section10({ products }: Section10Props) {
  const [selected, setSelected] = useState("new");

  const handleSelected = useCallback((item: string) => () => setSelected(item), []);

  const activeColor = useCallback(
    (item: string) => (item === selected ? "error" : "dark"),
    [selected]
  );

  const buttons = [
    { id: 1, title: "New Arrivals", type: "new" },
    { id: 2, title: "Best Seller", type: "best" },
    { id: 3, title: "Most Popular", type: "popular" },
    { id: 4, title: "View All", type: "view" }
  ];

  const responsive = [
    { breakpoint: 1200, settings: { slidesToShow: 4 } },
    { breakpoint: 1024, settings: { slidesToShow: 3 } },
    { breakpoint: 650, settings: { slidesToShow: 2 } },
    { breakpoint: 426, settings: { slidesToShow: 1 } }
  ];

  return (
    <Container mb="4rem">
      <FlexBox alignItems="center" justifyContent="space-between" flexWrap="wrap" mb="1.5rem">
        <div>
          <H2 fontSize={20}>Selected Products</H2>
          <Paragraph>All our new arrivals in a exclusive brand selection</Paragraph>
        </div>

        <ButtonsWrapper>
          {buttons.map(({ id, title, type }) => (
            <Button
              key={id}
              variant="outlined"
              color={activeColor(type)}
              onClick={handleSelected(type)}>
              {title}
            </Button>
          ))}
        </ButtonsWrapper>
      </FlexBox>

      <Carousel slidesToShow={5} responsive={responsive}>
        {products.map((product) => (
          <ProductCard19
            id={product.id}
            key={product.id}
            slug={product.slug}
            name={product.title}
            price={product.price}
            img={product.thumbnail}
            images={product.images as string[]}
            reviews={product.reviews?.length || 15}
          />
        ))}
      </Carousel>
    </Container>
  );
}
