import FlexBox from "@component/FlexBox";
import NavLink from "@component/nav-link";
import { H2 } from "@component/Typography";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import ProductCard19 from "@component/product-cards/ProductCard19";
// API FUNCTIONS
import api from "@utils/__api__/market-2";

const responsive = [
  { breakpoint: 1200, settings: { slidesToShow: 4 } },
  { breakpoint: 1024, settings: { slidesToShow: 3 } },
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 426, settings: { slidesToShow: 1 } }
];

export default async function Section4() {
  const products = await api.getProducts();

  return (
    <Container pt="4rem">
      <FlexBox alignItems="center" justifyContent="space-between" mb="1.5rem">
        <H2 fontSize={20}>Deals Of The Day</H2>
        <NavLink href="#">More Products</NavLink>
      </FlexBox>

      <Carousel slidesToShow={4} responsive={responsive}>
        {products.map((product) => (
          <ProductCard19
            key={product.id}
            id={product.id}
            slug={product.slug}
            name={product.title}
            price={product.price}
            img={product.thumbnail}
            images={product.images as string[]}
            reviews={product.reviews?.length || 11}
          />
        ))}
      </Carousel>
    </Container>
  );
}
