import Box from "@component/Box";
import { Carousel } from "@component/carousel";
import StorefrontProductCard from "@component/product-cards/StorefrontProductCard";
import CategorySectionCreator from "@component/CategorySectionCreator";
// API FUNCTIONS
import api from "@utils/__api__/market-1";

const responsive = [
  { breakpoint: 1024, settings: { slidesToShow: 4 } },
  { breakpoint: 959, settings: { slidesToShow: 3 } },
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 370, settings: { slidesToShow: 1 } }
];

export default async function Section2() {
  const products = await api.getFlashDeals();

  return (
    <CategorySectionCreator iconName="light" title="Flash Deals" seeMoreLink="#">
      <Box mt="-0.25rem" mb="-0.25rem">
        <Carousel slidesToShow={4} responsive={responsive}>
          {products.map((item) => (
            <Box py="0.25rem" key={item.id}>
              <StorefrontProductCard
                id={item.id}
                slug={item.slug}
                title={item.title}
                price={item.price}
                imgUrl={item.thumbnail}
                images={item.images}
                category={
                  Array.isArray(item.categories)
                    ? item.categories[0]?.name ?? item.categories[0]
                    : undefined
                }
                rating={typeof item.rating === "number" ? item.rating : undefined}
                reviewCount={
                  typeof item.ratingCount === "number" ? item.ratingCount : undefined
                }
              />
            </Box>
          ))}
        </Carousel>
      </Box>
    </CategorySectionCreator>
  );
}
