import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Button from "@component/buttons/Button";
import ProductCard10 from "@component/product-cards/ProductCard10";
import CategorySectionCreator from "@component/CategorySectionCreator";
// STYLED COMPONENT
import { SubTitle } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/grocery-1";

export default async function Section4() {
  const products = await api.getProducts();

  return (
    <CategorySectionCreator title="All Products" seeMoreLink="#">
      <SubTitle>Best collection in 2021 for you!</SubTitle>

      <Grid container spacing={6}>
        {products.map((item) => (
          <Grid key={item.id} item md={4} sm={6} xs={12}>
            <ProductCard10
              id={item.id}
              slug={item.slug}
              unit={item.unit}
              title={item.title}
              price={item.price}
              off={item.discount}
              rating={item.rating}
              imgUrl={item.thumbnail}
              images={item.images as string[]}
            />
          </Grid>
        ))}
      </Grid>

      <FlexBox alignItems="center" justifyContent="center" mt={32}>
        <Button color="primary" variant="contained">
          Load More...
        </Button>
      </FlexBox>
    </CategorySectionCreator>
  );
}
