"use client";

import { Carousel } from "@component/carousel";
import { ProductCard2 } from "@component/product-cards";
import CategorySectionCreator from "@component/CategorySectionCreator";
import Product from "@models/product.model";

// =============================================
type Props = { products: Product[] };
// =============================================

const responsive = [
  { breakpoint: 950, settings: { slidesToShow: 4 } },
  { breakpoint: 650, settings: { slidesToShow: 3 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default function Section5({ products }: Props) {
  return (
    <CategorySectionCreator title="New Arrivals">
      <Carousel slidesToShow={6} responsive={responsive}>
        {products.map((item) => (
          <div key={item.id}>
            <ProductCard2
              slug={item.slug}
              price={item.price}
              title={item.title}
              imgUrl={item.thumbnail}
            />
          </div>
        ))}
      </Carousel>
    </CategorySectionCreator>
  );
}
