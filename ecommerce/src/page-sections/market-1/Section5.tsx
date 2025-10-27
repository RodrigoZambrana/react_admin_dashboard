import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import StorefrontProductCard from "@component/product-cards/StorefrontProductCard";
import CategorySectionCreator from "@component/CategorySectionCreator";
// API FUNCTIONS
import api from "@utils/__api__/market-1";

export default async function Section5() {
  const newArrivalsList = await api.getNewArrivalList();

  return (
    <CategorySectionCreator iconName="new-product-1" title="New Arrivals" seeMoreLink="#">
      <Card p="1rem" borderRadius={8}>
        <Grid container spacing={6}>
          {newArrivalsList.map((item) => (
            <Grid item lg={2} md={3} sm={4} xs={6} key={item.title}>
              <StorefrontProductCard
                id={item.id}
                slug={item.slug}
                title={item.title}
                price={item.price}
                imgUrl={item.thumbnail}
                images={item.images}
                category={Array.isArray(item.categories) ? item.categories[0]?.name ?? item.categories[0] : undefined}
                rating={typeof item.rating === "number" ? item.rating : undefined}
                reviewCount={typeof item.ratingCount === "number" ? item.ratingCount : undefined}
              />
            </Grid>
          ))}
        </Grid>
      </Card>
    </CategorySectionCreator>
  );
}
