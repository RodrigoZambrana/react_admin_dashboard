import Link from "next/link";
import Box from "@component/Box";
import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import Container from "@component/Container";
import NextImage from "@component/NextImage";
import { H2, H4, Paragraph } from "@component/Typography";
// STYLED COMPONENTS
import { DateBox, ImageBox, StyledLink } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/fashion-2";

export default async function Section8() {
  const blogs = await api.getBlogs();

  return (
    <Container mt="4rem">
      <H2 textAlign="center" mb={4}>
        Latest Articles
      </H2>

      <Grid container spacing={5}>
        {blogs.map((item) => (
          <Grid item md={4} xs={12} key={item.id}>
            <Card boxShadow="small" borderRadius={0} padding=".8rem">
              <ImageBox>
                <NextImage width={580} height={272} alt="blog-1" src={item.thumbnail} />

                <DateBox>
                  <Paragraph width="min-content" lineHeight={1} fontWeight={600}>
                    {item.createdAt}
                  </Paragraph>
                </DateBox>
              </ImageBox>

              <Box p={0} pt={3}>
                <Link href="#">
                  <H4 fontWeight={700}>{item.title}</H4>
                </Link>

                <Paragraph mt={0.5} mb={3}>
                  {item.description}
                </Paragraph>

                <StyledLink href="#">Read More</StyledLink>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
