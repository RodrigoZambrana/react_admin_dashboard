"use client";

import Image from "next/image";
import { Link as Scroll } from "react-scroll";

import Header from "./header";
import Box from "@component/Box";
import Card from "@component/Card";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import NextImage from "@component/NextImage";
import Container from "@component/Container";
import { H2, H4, Paragraph, Span } from "@component/Typography";

import figma from "../../../public/assets/images/icons/figma.svg";
import pageGroup from "../../../public/assets/images/landing/page-group.png";
import thisIsBonik from "../../../public/assets/images/landing/this-bonik.svg";

export default function Section1() {
  return (
    <div>
      <Header />

      <Container id="section-1" mt="4rem" mb="7rem" position="relative">
        <Box maxWidth="830px" mx="auto" mb="64px" textAlign="center">
          <Box mx="auto" maxWidth="360px">
            <NextImage alt="bonik" src={thisIsBonik} loading="eager" priority />
          </Box>

          <H4 color="primary.main" fontSize="18px">
            React, NextJs, Typescript
          </H4>

          <H2 color="secondary.main" fontSize="40px" mb="1rem" fontWeight="900">
            The Best React eCommerce Template
          </H2>

          <Paragraph color="gray.700" maxWidth="400px" mx="auto" mb="2rem">
            SEO friendly server side rendered React Next.js multipurpose eCommerce template.
          </Paragraph>

          <FlexBox justifyContent="center" m="-0.5rem">
            <a href="https://1.envato.market/oeNbNe">
              <Button variant="contained" color="primary" m="0.5rem">
                Purchase Now
              </Button>
            </a>

            <Scroll to="demos" duration={500} offset={-72 - 16} smooth={true}>
              <Button variant="outlined" color="primary" m="0.5rem">
                View Demos
              </Button>
            </Scroll>
          </FlexBox>

          <Box mt={4}>
            <a
              href="mailto:support@ui-lib.com?subject=I need Bonik server solution"
              target="_blank">
              <Paragraph
                color="gray.600"
                style={{ textDecoration: "underline", cursor: "pointer" }}>
                I need a Server & Database
              </Paragraph>
            </a>
          </Box>
        </Box>

        <NextImage
          alt="bonik"
          src={pageGroup}
          placeholder="blur"
          blurDataURL={pageGroup.blurDataURL}
        />

        <Card
          bottom="-36px"
          borderRadius={8}
          position="absolute"
          boxShadow="regular"
          left="calc(50% - 95px)">
          <Box p="1.5rem 2.5rem" display="flex" alignItems="center">
            <Span fontWeight="700" ml="1rem">
              Ready For
            </Span>

            <Image alt="Figma" src={figma} width={24} height={24} />
          </Box>
        </Card>
      </Container>
    </div>
  );
}
