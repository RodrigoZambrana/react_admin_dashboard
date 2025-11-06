import Image from "next/image";
import Grid from "@component/grid/Grid";
import Container from "@component/Container";
import { H2, H4 } from "@component/Typography";
import { CategoryWrapper, CategoryTitle } from "./Section10.styles";
import api from "@utils/__api__/market-1";

export default async function Section10() {
  const categories = await api.getCategories();

  return (
    <Container mb="70px">
      <H2 textAlign="center" mb={4} fontWeight={700}>
        Explore Popular Categories
      </H2>

      <Grid container spacing={6}>
        {categories.map((category) => (
          <Grid item md={3} sm={6} xs={12} key={category.id}>
            <CategoryWrapper>
              <Image
                width={400}
                height={400}
                src={category.image ?? "/assets/images/products/placeholder.png"}
                alt={category.name ?? "category"}
                style={{ width: "100%", height: "auto", objectFit: "cover" }}
              />

              <CategoryTitle className="category-title">
                <H4 fontWeight={600}>{category.name}</H4>
              </CategoryTitle>
            </CategoryWrapper>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
