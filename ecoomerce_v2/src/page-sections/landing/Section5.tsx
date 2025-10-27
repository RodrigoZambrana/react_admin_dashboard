"use client";

import { motion } from "framer-motion";
import styled from "styled-components";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Container from "@component/Container";
import NextImage from "@component/NextImage";
import { H2, Paragraph } from "components/Typography";

import modelImage from "../../../public/assets/images/landing/product-model.png";
import apiImage from "../../../public/assets/images/landing/rest-api-endpoint.png";

// STYLED COMPONENT
const ImageBox = styled(motion.div)(({ theme }) => ({
  padding: 32,
  display: "flex",
  borderRadius: 16,
  justifyContent: "center",
  backgroundColor: theme.colors.gray[300]
}));

const Features = styled(motion.div)(() => ({
  marginTop: 32
}));

const FeatureItem = styled(motion.div)(({ theme }) => ({
  marginTop: "1rem",
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  color: theme.colors.gray[900]
}));

const contentVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const featuresVariants = {
  hidden: {
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.2
    }
  },
  visible: {
    transition: {
      staggerChildren: 0.2,
      delayChildren: -1
    }
  }
};

const featureItemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const model = [
  "Product model",
  "User model",
  "Shop model",
  "Order model",
  "Address model",
  "20+ more models"
];

export default function Section5() {
  return (
    <Box mb={4}>
      <Container>
        <Box my={170}>
          <Grid container spacing={20} alignItems="center" justifyContent="center">
            <Grid item lg={4} md={5} sm={6} xs={10}>
              <ImageBox
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}>
                <NextImage src={modelImage} alt="bonik" />
              </ImageBox>
            </Grid>

            <Grid item lg={4} md={5} sm={6} xs={10}>
              <motion.div
                variants={contentVariants}
                initial="hidden"
                whileInView="visible"
                transition={{ duration: 0.5, delay: 0.3 }}>
                <H2 fontSize={{ md: 28, xs: 27 }}>Data structure with Typescript Data models</H2>

                <Features variants={featuresVariants} whileInView="visible" initial="hidden">
                  {model.map((item, index) => (
                    <FeatureItem
                      initial="hidden"
                      whileInView="visible"
                      variants={featureItemVariants}
                      transition={{ duration: 0.3, delay: 0.1 * index }}>
                      ✅{" "}
                      <Paragraph ml={2} fontSize={18}>
                        {item}
                      </Paragraph>
                    </FeatureItem>
                  ))}
                </Features>
              </motion.div>
            </Grid>
          </Grid>
        </Box>

        <Box mb={170}>
          <Grid container spacing={4} alignItems="center" justifyContent="center">
            <Grid item lg={4} md={5} xs={10}>
              <motion.div
                variants={contentVariants}
                initial="hidden"
                whileInView="visible"
                transition={{ duration: 0.5, delay: 0.3 }}>
                <H2 fontSize={28}>REST API endpoints</H2>

                <Paragraph fontSize={16}>
                  Customize and use existing data structure to implement your server easily.
                </Paragraph>
              </motion.div>
            </Grid>

            <Grid item md={6} xs={12}>
              <ImageBox
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}>
                <NextImage src={apiImage} alt="bonik" />
              </ImageBox>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
