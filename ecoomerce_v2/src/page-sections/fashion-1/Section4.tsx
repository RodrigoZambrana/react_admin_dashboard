import Box from "@component/Box";
import { Carousel } from "@component/carousel";
import ProductCard2 from "@component/product-cards/ProductCard2";
import CategorySectionCreator from "@component/CategorySectionCreator";
// API FUNCTIONS
import api from "@utils/__api__/fashion-1";

const responsive = [
  { breakpoint: 950, settings: { slidesToShow: 4 } },
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } }
];

export default async function Section4() {
  const products = await api.getNewArrivals();

  return (
    <CategorySectionCreator iconName="new-product-1" title="New Arrivals" seeMoreLink="#">
      <Box mt="-0.25rem" mb="-0.25rem">
        <Carousel slidesToShow={6} responsive={responsive}>
          {products.map((item) => (
            <Box py="0.25rem" key={item.id}>
              <ProductCard2
                slug={item.slug}
                price={item.price}
                title={item.title}
                imgUrl={item.thumbnail}
              />
            </Box>
          ))}
        </Carousel>
      </Box>
    </CategorySectionCreator>
  );
}
