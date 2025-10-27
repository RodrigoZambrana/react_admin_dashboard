"use client";

import NextImage from "next/image";
import { useState } from "react";
import styled from "styled-components";
import { IconHeartFilled } from "@tabler/icons-react";

import Box from "@component/Box";
import Card from "@component/Card";
import Image from "@component/Image";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import { Carousel } from "@component/carousel";
import { H3, H4, Paragraph, SemiSpan } from "@component/Typography";
// IMAGES
import hotBadgeImage from "../../../public/assets/images/badges/hot.svg";

// STYLED COMPONENT
const SectionWrapper = styled.div`
  margin-top: -0.25rem;
  margin-bottom: -0.25rem;

  .hot {
    top: 0;
    right: 3.5rem;
    position: absolute;
  }

  .dot-group {
    left: 20%;
    bottom: 1rem;
    position: absolute;
  }

  @media only screen and (max-width: 768px) {
    .hot {
      right: 0;
      width: 10%;
    }
    .dot-group {
      display: none;
    }
  }
`;

// ===========================================
type Props = { list: any[] };
// ===========================================

export default function Section6({ list }: Props) {
  const totalSlides = list.length;
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleSlideChange = (count: number) => () => {
    if (count < 0) setCurrentSlide(0);
    else if (count > totalSlides - 1) setCurrentSlide(totalSlides - 1);
    else setCurrentSlide(count);
  };

  return (
    <Box mb="3.75rem">
      <SectionWrapper>
        <Carousel slidesToShow={1}>
          {list.map((item) => (
            <Box py="0.35rem" key={item.id}>
              <Card
                p="1rem"
                bg="secondary.100"
                overflow="hidden"
                position="relative"
                borderRadius={12}>
                <Grid container alignItems="center" spacing={6}>
                  <Grid item md={6} xs={12}>
                    <Image src={item.imgUrl} alt="watch" display="block" margin="auto" />
                  </Grid>

                  <Grid item md={6} xs={12}>
                    <H3 mb="0.875rem" color="primary.main" lineHeight="1.3">
                      Deal Of The Day
                    </H3>

                    <H3 mb="0.5rem" fontSize="25px" lineHeight="1.2">
                      {item.productName}
                    </H3>

                    <Paragraph mb="2rem" color="text.muted" maxWidth="400px">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quis lobortis
                      consequat eu, quam etiam at quis ut convallis.
                    </Paragraph>

                    <H4 mb="0.5rem" lineHeight="1.3" fontWeight="600">
                      Fresh Deal Everyday, Get It Now!
                    </H4>

                    <FlexBox flexWrap="wrap" mb="2rem">
                      <FlexBox alignItems="flex-end" mr="1.75rem">
                        <H3 lineHeight="1.3" mr="0.25rem">
                          365
                        </H3>

                        <SemiSpan fontWeight="600" lineHeight="1.7">
                          DAYS
                        </SemiSpan>
                      </FlexBox>

                      <FlexBox alignItems="flex-end" mr="1.75rem">
                        <H3 lineHeight="1.3" mr="0.25rem">
                          22
                        </H3>

                        <SemiSpan fontWeight="600" lineHeight="1.7">
                          HOURS
                        </SemiSpan>
                      </FlexBox>

                      <FlexBox alignItems="flex-end" mr="1.75rem">
                        <H3 lineHeight="1.3" mr="0.25rem">
                          39
                        </H3>

                        <SemiSpan fontWeight="600" lineHeight="1.7">
                          MINS
                        </SemiSpan>
                      </FlexBox>

                      <FlexBox alignItems="flex-end">
                        <H3 lineHeight="1.3" mr="0.25rem">
                          42
                        </H3>

                        <SemiSpan fontWeight="600" lineHeight="1.7">
                          SECS
                        </SemiSpan>
                      </FlexBox>
                    </FlexBox>

                    <FlexBox alignItems="center">
                      <Button color="primary" variant="contained" borderRadius={8} mr="0.5rem">
                        BUY NOW
                      </Button>

                      <FlexBox
                        size="40px"
                        color="white"
                        bg="gray.500"
                        borderRadius={8}
                        alignItems="center"
                        justifyContent="center"
                        style={{ cursor: "pointer" }}>
                        <IconHeartFilled size={24} />
                      </FlexBox>
                    </FlexBox>
                  </Grid>
                </Grid>

                <NextImage className="hot" src={hotBadgeImage} alt="Hot Offer" />
              </Card>
            </Box>
          ))}
        </Carousel>
      </SectionWrapper>
    </Box>
  );
}
