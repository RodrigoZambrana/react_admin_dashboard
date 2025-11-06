import Link from "next/link";
import { Carousel } from "@component/carousel";
import ProductCard6 from "@component/product-cards/ProductCard6";
import CategorySectionCreator from "@component/CategorySectionCreator";
// API FUNCTIONS
import api from "@utils/__api__/market-1";

const responsive = [
  { breakpoint: 959, settings: { slidesToShow: 2 } },
  { breakpoint: 650, settings: { slidesToShow: 1 } }
];

export default async function Section3() {
  const categoryList = await api.getTopCategories();
  const slidesToShow = Math.min(3, Math.max(1, categoryList.length || 1));
  const responsiveConfig = responsive.map((item) => ({
    ...item,
    settings: {
      ...item.settings,
      slidesToShow: Math.min(item.settings.slidesToShow, slidesToShow)
    }
  }));

  return (
    <CategorySectionCreator iconName="categories" title="Top Categories" seeMoreLink="#">
      <Carousel slidesToShow={slidesToShow} responsive={responsiveConfig}>
        {categoryList.map((item) => (
          <Link href={`/product/search/${item.slug}`} key={item.id}>
            <ProductCard6
              title={item.name ?? ""}
              imgUrl={item.image ?? "/assets/images/products/placeholder.png"}
              subtitle={item.description ?? ""}
            />
          </Link>
        ))}
      </Carousel>
    </CategorySectionCreator>
  );
}
