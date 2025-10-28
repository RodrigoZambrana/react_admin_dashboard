import Box from "@component/Box";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import { CarouselCard1 } from "@component/carousel-cards";
import { defaultMarket1MainCarousel } from "@/data/market1Defaults";

export default function Section1() {
  const carouselData = defaultMarket1MainCarousel;

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
