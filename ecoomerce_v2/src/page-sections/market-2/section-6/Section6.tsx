"use client";

import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import NavLink from "@component/nav-link";
import { H3 } from "@component/Typography";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import { ProductCard19 } from "@component/product-cards";
import { CategoryBasedProducts } from "@models/market-2.model";
// STYLED COMPONENTS
import { List, ListItem } from "./styles";

// ======================================================================
type Props = { data: CategoryBasedProducts };
// ======================================================================

const responsive = [
  { breakpoint: 1200, settings: { slidesToShow: 3 } },
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 426, settings: { slidesToShow: 1 } }
];

export default function Section6({ data }: Props) {
  return (
    <Container pt="4rem">
      <Grid container spacing={3}>
        <Grid item md={3} xs={12}>
          <Card
            elevation={0}
            style={{
              border: 0,
              height: "100%",
              borderRadius: "3px",
              padding: "1rem 2rem"
            }}>
            {/* MAIN CATEGORY NAME/TITLE */}
            <H3>{data.category.title}</H3>

            {/* SUB CATEGORY LIST */}
            <List>
              {data.category.children.map((item) => (
                <ListItem key={item}>{item}</ListItem>
              ))}
            </List>

            <NavLink href="#">Browse All</NavLink>
          </Card>
        </Grid>

        {/* CATEGORY BASED PRODUCTS CAROUSEL */}
        <Grid item md={9} xs={12}>
          <Carousel slidesToShow={4} responsive={responsive}>
            {data.products.map((product) => (
              <ProductCard19
                id={product.id}
                key={product.id}
                slug={product.slug}
                name={product.title}
                price={product.price}
                img={product.thumbnail}
                images={product.images as string[]}
                reviews={product.reviews?.length || 14}
              />
            ))}
          </Carousel>
        </Grid>
      </Grid>
    </Container>
  );
}
