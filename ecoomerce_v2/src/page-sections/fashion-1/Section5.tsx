"use client";

import Link from "next/link";
import styled from "styled-components";

import Box from "@component/Box";
import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import { H2 } from "@component/Typography";
import NextImage from "@component/NextImage";
import { Carousel } from "@component/carousel";

// STYLED COMPONENTS
const SectionWrapper = styled.div`
  margin-bottom: 3.75rem;

  .left-arrow,
  .right-arrow {
    position: absolute;
    top: -34px;
    right: 0;
  }
  .left-arrow {
    right: 48px;
    left: auto;
  }
  .hinde-on-mobile {
    display: block;
  }
  @media only screen and (max-width: 425px) {
    .hinde-on-mobile {
      display: none;
    }
  }
`;

// ==========================================================
type Props = { list: any[] };
// ==========================================================

export default function Section5({ list }: Props) {
  const totalSlides = list.length / 4;
  const firstIndex = 0 * 4;
  const lastIndex = firstIndex + 4;

  return (
    <SectionWrapper>
      <H2 fontWeight="bold" lineHeight="1" mb="1.5rem">
        Deal Of The Week
      </H2>

      <Box mt="-0.25rem" mb="-0.25rem">
        <Carousel dots slidesToShow={1} arrows={false}>
          {Array.from({ length: totalSlides }).map((_item, ind) => (
            <Box py="0.25rem" key={ind}>
              <Grid container spacing={6}>
                {list.slice(firstIndex, lastIndex).map((item, ind) => (
                  <Grid item md={6} xs={12} key={ind}>
                    <Link href="/">
                      <Card position="relative" borderRadius={8} overflow="hidden" display="flex">
                        <NextImage src={item.imgUrl} width={581} height={226} alt={item.brand} />

                        <Box
                          p="6px 12px"
                          bg="gray.200"
                          top="1.25rem"
                          left="1.25rem"
                          fontWeight="600"
                          borderRadius={5}
                          position="absolute">
                          {item.brand}
                        </Box>

                        <Box
                          p="6px 12px"
                          color="white"
                          top="1.25rem"
                          right="1.25rem"
                          fontWeight="600"
                          borderRadius={5}
                          bg="primary.main"
                          position="absolute">
                          {item.off}% OFF
                        </Box>
                      </Card>
                    </Link>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Carousel>
      </Box>
    </SectionWrapper>
  );
}
