import Grid from "@component/grid/Grid";
import { H3 } from "@component/Typography";
import Container from "@component/Container";
import ProductCard18 from "@component/product-cards/ProductCard18";
import Product from "@models/product.model";
// API FUNCTIONS
import api from "@utils/__api__/fashion-2";

export default async function Section10() {
  const saleProducts = await api.getSaleProducts();
  const latestProducts = await api.getLatestProducts();
  const popularProducts = await api.getPopularProducts();
  const bestWeekProducts = await api.getBestWeekProducts();

  return (
    <Container py="5rem">
      <Grid container spacing={5}>
        <Block title="Sale Products" products={saleProducts} />
        <Block title="Latest Products" products={latestProducts} />
        <Block title="Best of the Week" products={bestWeekProducts} />
        <Block title="Popular Products" products={popularProducts} />
      </Grid>
    </Container>
  );
}

const Block = ({ title, products }: { title: string; products: Product[] }) => {
  return (
    <Grid item lg={3} sm={6} xs={12}>
      <H3 mb={3}>{title}</H3>

      {products.map((product) => (
        <ProductCard18
          rating={4}
          key={product.id}
          slug={product.slug}
          title={product.title}
          price={product.price}
          image={product.thumbnail}
        />
      ))}
    </Grid>
  );
};
