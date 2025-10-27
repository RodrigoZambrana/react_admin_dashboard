import Box from "@component/Box";
import NextImage from "@component/NextImage";
import { Carousel } from "components/carousel";
import { H1, Paragraph } from "components/Typography";
// STYLED COMPONENTS
import { GridItemOne, GridItemTwo, StyledBox, StyledButton, StyledGrid } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/gift";

export default async function Section1() {
  const carouselData = await api.getMainCarouselData();

  return (
    <StyledBox id="carouselBox">
      <Carousel
        dots
        arrows={false}
        spaceBetween={0}
        slidesToShow={1}
        // dotColor={theme.colors.marron.main}
      >
        {carouselData.map((item) => (
          <div key={item.id}>
            <StyledGrid container>
              <GridItemOne item md={6} xs={12}>
                <Box py={6}>
                  <Paragraph color="primary.main" mb={2}>
                    {item.subTitle}
                  </Paragraph>

                  <H1 mb={4}>{item.title}</H1>

                  <StyledButton variant="contained" color="primary">
                    Shop Now
                  </StyledButton>
                </Box>
              </GridItemOne>

              <GridItemTwo item md={6} xs={12}>
                <NextImage priority width={600} height={450} src={item.imgUrl} alt="bonik" />
              </GridItemTwo>
            </StyledGrid>
          </div>
        ))}
      </Carousel>
    </StyledBox>
  );
}
