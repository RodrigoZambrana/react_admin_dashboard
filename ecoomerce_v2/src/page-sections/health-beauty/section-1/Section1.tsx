"use client";

import { useTheme } from "styled-components";
import Box from "@component/Box";
import { H1 } from "components/Typography";
import LazyImage from "components/LazyImage";
import { Carousel } from "components/carousel";
import { HealthCarouselItem } from "@models/carousel.model";
// STYLED COMPONENTS
import { GridItemOne, GridItemTwo, StyledButton, StyledGrid, StyledRoot } from "./styles";

// ==========================================================================
type Props = { id: string; carouselData: HealthCarouselItem[] };
// ==========================================================================

export default function Section1({ id, carouselData }: Props) {
  const theme = useTheme();

  return (
    <StyledRoot id={id}>
      <Carousel dots arrows={false} slidesToShow={1} dotStyles={{ bottom: 25 }}>
        {carouselData.map(({ id, imgUrl, title }) => (
          <div key={id}>
            <StyledGrid container>
              <GridItemOne item md={6} xs={12}>
                <Box py={6}>
                  <H1 mb={4}>{title}</H1>
                  <StyledButton variant="contained">Shop Now</StyledButton>
                </Box>
              </GridItemOne>

              <GridItemTwo item md={6} xs={12}>
                <LazyImage priority width={570} height={360} src={imgUrl} alt="bonik" />
              </GridItemTwo>
            </StyledGrid>
          </div>
        ))}
      </Carousel>
    </StyledRoot>
  );
}
