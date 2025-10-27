import Box from "@component/Box";
import Card from "@component/Card";
import AppStore from "@component/AppStore";
import NextImage from "@component/NextImage";
import { Carousel } from "@component/carousel";
import { H1, H5, H6 } from "@component/Typography";
// STYLED COMPONENTS
import { ContentWrapper, Wrapper } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/grocery-2";

export default async function Section1() {
  const carouselData = await api.getMainCarousel();

  return (
    <Wrapper>
      <Carousel
        dots
        autoplay
        arrows={false}
        spaceBetween={0}
        slidesToShow={1}
        dotColor="white"
        dotStyles={{ bottom: 25 }}>
        {carouselData.map((item) => (
          <Card key={item.id} bg="primary.main" color="white" borderRadius={0} position="relative">
            <ContentWrapper>
              <div className="card__inner-box">
                <H1 maxWidth="280px" mb="0.5rem" lineHeight="1.27">
                  {item.title}
                </H1>

                <H6 maxWidth="470px" color="inherit" fontWeight="400" mb="2.5rem">
                  {item.description}
                </H6>

                <H5 fontSize="18px" fontWeight="700" mb="1.25rem">
                  Try our mobile app!
                </H5>

                <AppStore />
              </div>

              <Box className="card__img" minWidth="285px" height="180px" position="relative">
                <NextImage alt="bonik" src={item.imgUrl} width={286} height={181} />
              </Box>
            </ContentWrapper>
          </Card>
        ))}
      </Carousel>
    </Wrapper>
  );
}
