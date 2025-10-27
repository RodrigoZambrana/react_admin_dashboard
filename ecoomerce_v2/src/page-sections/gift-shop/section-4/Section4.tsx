"use client";

import Link from "next/link";

import { H1 } from "components/Typography";
import { Carousel } from "components/carousel";
import ProductCard14 from "@component/product-cards/ProductCard14";
// STYLED COMPONENT
import { Wrapper } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/gift";

const responsive = [
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default async function Section4() {
  const categories = await api.getTopCategories();

  return (
    <Wrapper className="categories">
      <H1 mb={3}>Top Categories</H1>

      <Carousel slidesToShow={3} responsive={responsive}>
        {categories.map((item) => (
          <Link href="#" key={item.id}>
            <ProductCard14 title={item.name} imgUrl={item.image} available={item.description} />
          </Link>
        ))}
      </Carousel>
    </Wrapper>
  );
}
