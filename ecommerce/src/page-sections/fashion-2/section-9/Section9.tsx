import Image from "@component/Image";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import defaultFashion2Brands from "@/data/fashion2Brands";

export default function Section9() {
  const brands = defaultFashion2Brands;

  const responsive = [
    { breakpoint: 1024, settings: { slidesToShow: 3 } },
    { breakpoint: 650, settings: { slidesToShow: 2 } },
    { breakpoint: 426, settings: { slidesToShow: 1 } }
  ];

  return (
    <Container mt="4rem">
      <Divider mb="2rem" backgroundColor="gray.400" />

      <Carousel autoplay arrows={false} slidesToShow={5} responsive={responsive}>
        {brands.map((item) => (
          <FlexBox
            key={item.id}
            height="100%"
            margin="auto"
            maxWidth={110}
            alignItems="center"
            justifyContent="center">
            <Image src={item.image} alt="brand" width="100%" style={{ filter: "grayscale(1)" }} />
          </FlexBox>
        ))}
      </Carousel>

      <Divider mt="2rem" backgroundColor="gray.400" />
    </Container>
  );
}
