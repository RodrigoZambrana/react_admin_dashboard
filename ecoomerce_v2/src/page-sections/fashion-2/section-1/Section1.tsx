import Box from "@component/Box";
import Image from "@component/Image";
import Grid from "@component/grid/Grid";
import { Button } from "@component/buttons";
import Container from "@component/Container";
import { Carousel } from "components/carousel";
import { Paragraph } from "@component/Typography";
// STYLED COMPONENT
import { StyledBox } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/fashion-2";

export default async function Section1() {
  const data = await api.getMainCarouselData();

  return (
    <Box bg="gray.100" mb={7.5}>
      <Container py={4}>
        <Carousel
          dots
          autoplay
          arrows={false}
          slidesToShow={1}
          spaceBetween={0}
          dotStyles={{ bottom: 0 }}>
          {data.map((item, ind) => (
            <StyledBox key={ind}>
              <Grid container spacing={3} alignItems="center" justifyContent="center">
                <Grid item className="grid-item" md={5} xs={12}>
                  <h1 className="title">{item.title}</h1>
                  <Paragraph color="secondary.main" mb={2.7}>
                    {item.description}
                  </Paragraph>

                  <a href={item.buttonLik}>
                    <Button
                      mt={4}
                      size="medium"
                      color="primary"
                      variant="contained"
                      className="button-link">
                      {item.buttonText}
                    </Button>
                  </a>
                </Grid>

                <Grid item md={6} xs={12}>
                  <Image alt="apple-watch-1" src={item.imgUrl} />
                </Grid>
              </Grid>
            </StyledBox>
          ))}
        </Carousel>
      </Container>
    </Box>
  );
}
