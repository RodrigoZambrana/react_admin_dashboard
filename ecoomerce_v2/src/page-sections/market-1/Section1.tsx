import Box from "@component/Box";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import { CarouselCard1 } from "@component/carousel-cards";
// API FUNCTIONS
import api from "@utils/__api__/market-1";

export default async function Section1() {
  const carouselData = await api.getMainCarousel();

  return (
    <Box bg="gray.white" mb="3.75rem">
      <Container pb="3rem">
        <Carousel dots autoplay arrows={false} slidesToShow={1}>
          {carouselData.map((item, index) => (
            <CarouselCard1
              key={index}
              title={item.title}
              image={item.imgUrl}
              buttonText={item.buttonText}
              description={item.description}
            />
          ))}
        </Carousel>
      </Container>
    </Box>
  );
}
