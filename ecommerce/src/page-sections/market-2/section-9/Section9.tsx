"use client";

import Box from "@component/Box";
import Image from "@component/Image";
import FlexBox from "@component/FlexBox";
import { H2 } from "@component/Typography";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import Brand from "@models/Brand.model";

// ==========================================================
type Props = { brands: Brand[] };
// ==========================================================

const responsive = [
  { breakpoint: 1200, settings: { slidesToShow: 4 } },
  { breakpoint: 1024, settings: { slidesToShow: 3 } },
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 426, settings: { slidesToShow: 1 } }
];

export default function Section9({ brands }: Props) {
  return (
    <Container my="4rem">
      <H2 fontSize={20} mb="1.5rem">
        Featured Brands
      </H2>

      <Box padding="2rem" bg="white">
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
      </Box>
    </Container>
  );
}
