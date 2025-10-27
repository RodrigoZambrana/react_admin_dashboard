import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import { CarouselCard2 } from "@component/carousel-cards";
// STYLED COMPONENTS
import { Wrapper } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/fashion-3";

export default async function Section1() {
  const carouselData = await api.getMainCarouselData();

  return (
    <Container pt="1.5rem">
      <Wrapper>
        <Carousel
          dots
          arrows={false}
          spaceBetween={0}
          slidesToShow={1}
          dotColor="white"
          dotStyles={{ bottom: 20 }}>
          {carouselData.map((item, index) => (
            <CarouselCard2
              key={index}
              mode="dark"
              title={item.title}
              bgImage={item.imgUrl}
              category={item.category}
              discount={item.discount}
            />
          ))}
        </Carousel>
      </Wrapper>
    </Container>
  );
}
