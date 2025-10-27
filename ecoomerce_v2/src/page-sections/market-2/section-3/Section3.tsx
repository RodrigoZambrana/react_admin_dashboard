import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import Container from "@component/Container";
import NextImage from "@component/NextImage";
import { H4, Paragraph, Span } from "@component/Typography";
// STYLED COMPONENTS
import {
  AdTitle1,
  AdWrapper,
  AddButton,
  AnimatedText,
  CategoryCard,
  CategoryTitle
} from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/market-2";

export default async function Section3() {
  const categories = await api.getCategories();

  return (
    <Container pt="4rem">
      <Grid container spacing={3}>
        {categories.map((item) => (
          <Grid item lg={2} md={3} sm={4} xs={6} key={item.id}>
            <CategoryCard>
              <NextImage width={300} height={300} alt="category" src={item.image as string} />

              <CategoryTitle className="category-title">
                <H4>{item.name}</H4>
              </CategoryTitle>
            </CategoryCard>
          </Grid>
        ))}

        <Grid item xs={12}>
          <AdWrapper>
            <AdTitle1>Black friday sale!</AdTitle1>

            <Paragraph ellipsis fontSize={28} flex={1} style={{ zIndex: 5 }}>
              <AnimatedText>
                Pay only for{" "}
                <Span
                  fontWeight={700}
                  fontSize="inherit"
                  style={{
                    textOverflow: "hidden",
                    whiteSpace: "nowrap",
                    textTransform: "uppercase"
                  }}>
                  your loving electronics
                </Span>
              </AnimatedText>
            </Paragraph>

            <Box padding="1.5rem" flexShrink={0} zIndex={5}>
              <AddButton variant="contained" color="primary">
                Shop Now
              </AddButton>
            </Box>
          </AdWrapper>
        </Grid>
      </Grid>
    </Container>
  );
}
