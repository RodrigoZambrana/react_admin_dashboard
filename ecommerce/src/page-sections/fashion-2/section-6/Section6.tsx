import { H2 } from "@component/Typography";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import ProductCard17 from "@component/product-cards/ProductCard17";
// API FUNCTIONS
import api from "@utils/__api__/fashion-2";

export default async function Section6() {
  const products = await api.getFeatureProducts();

  const responsive = [
    { breakpoint: 1200, settings: { slidesToShow: 4 } },
    { breakpoint: 1024, settings: { slidesToShow: 3 } },
    { breakpoint: 650, settings: { slidesToShow: 2 } },
    { breakpoint: 426, settings: { slidesToShow: 1 } }
  ];

  return (
    <Container mt="4rem">
      <H2 textAlign="center" mb={4}>
        Featured Products
      </H2>

      <Carousel slidesToShow={4} responsive={responsive}>
        {products.map((product) => (
          <ProductCard17
            id={product.id}
            key={product.id}
            slug={product.slug}
            title={product.title}
            price={product.price}
            images={product.images}
            imgUrl={product.thumbnail}
            category={product.categories[0]}
            reviews={product.reviews?.length || 21}
          />
        ))}
      </Carousel>
    </Container>
  );
}
