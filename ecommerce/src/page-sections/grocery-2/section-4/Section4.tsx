import Box from "@component/Box";
import { H3 } from "@component/Typography";
import { Carousel } from "@component/carousel";
import ProductCard10 from "@component/product-cards/ProductCard10";
import Product from "@models/product.model";

// =======================================================
type Props = { title: string; products: Product[] };
// =======================================================

const responsive = [
  { breakpoint: 950, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default function Section4({ title, products }: Props) {
  return (
    <div>
      <H3 fontSize="25px" mb="2rem">
        {title}
      </H3>

      <Box my="-0.25rem">
        <Carousel slidesToShow={3} responsive={responsive}>
          {products.map((item) => (
            <Box py="0.25rem" key={item.id}>
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
    </div>
  );
}
