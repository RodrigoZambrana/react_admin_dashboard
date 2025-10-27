import Image from "next/image";
import Grid from "@component/grid/Grid";
import Container from "@component/Container";
import { H2, H4 } from "@component/Typography";
// STYLED COMPONENTS
import { CategoryTitle, Wrapper } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/fashion-2";

export default async function Section3() {
  const categories = await api.getCategories();

  return (
    <Container mt="4rem">
      <H2 textAlign="center" mb={4}>
        Best selling Categories
      </H2>

      <Grid container spacing={6}>
        {categories.map((item) => (
          <Grid item md={3} sm={6} xs={12} key={item.id}>
            <Wrapper>
              <Image
                width={300}
                height={300}
                alt="category"
                src={item.image}
                style={{ width: "100%", objectFit: "cover" }}
              />

              <CategoryTitle className="category-title">
                <H4>{item.name}</H4>
              </CategoryTitle>
            </Wrapper>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
