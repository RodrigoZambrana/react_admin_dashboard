import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import ProductCard1 from "@component/product-cards/ProductCard1";
import CategorySectionCreator from "@component/CategorySectionCreator";
// API FUNCTIONS
import api from "@utils/__api__/market-1";

export default async function Section2() {
  const products = await api.getFlashDeals();

  return (
    <CategorySectionCreator iconName="light" title="Flash Deals" seeMoreLink="#">
      <Card p="1rem" borderRadius={8}>
        <Grid container spacing={6}>
          {products.map((item) => (
            <Grid item lg={3} md={4} sm={6} xs={12} key={item.id}>
              <ProductCard1
                id={item.id}
                slug={item.slug}
                title={item.title}
                price={item.price}
                basePrice={item.basePrice}
                currencyCode={item.currency}
                off={item.discount ?? 0}
                imgUrl={item.thumbnail}
                images={item.images}
                rating={item.rating ?? 4}
              />
            </Grid>
          ))}
        </Grid>
      </Card>
    </CategorySectionCreator>
  );
}
