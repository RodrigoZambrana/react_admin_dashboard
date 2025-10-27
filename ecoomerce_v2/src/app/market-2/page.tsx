// API FUNCTIONS
import api from "@utils/__api__/market-2";
// GLOBAL CUSTOM COMPONENTS
import Box from "@component/Box";
// PAGE SECTION COMPONENTS
import Section1 from "@sections/market-2/section-1";
import Section2 from "@sections/market-2/section-2";
import Section3 from "@sections/market-2/section-3";
import Section4 from "@sections/market-2/section-4";
import Section5 from "@sections/market-2/section-5";
import Section6 from "@sections/market-2/section-6";
import Section7 from "@sections/market-2/section-7";
import Section8 from "@sections/market-2/section-8";
import Section9 from "@sections/market-2/section-9";
import Section10 from "@sections/market-2/section-10";

export default async function MarketTwo() {
  const [brands, products, menFashionProducts, electronicsProducts, womenFashionProducts] =
    await Promise.all([
      api.getBrands(),
      api.getProducts(),
      api.getMenFashionProducts(),
      api.getElectronicsProducts(),
      api.getWomenFashionProducts()
    ]);

  return (
    <Box bg="#F6F6F6">
      {/* HERO CAROUSEL AREA */}
      <Section1 />

      {/* SERVICE LIST AREA */}
      <Section2 />

      {/* TOP CATEGORIES AREA */}
      <Section3 />

      {/* DEAL OF THE DAY PRODUCTS AREA */}
      <Section4 />

      {/* NEW ARRIVALS AND BEST SELLER OFFER BANNER AREA */}
      <Section5 />

      {/* ELECTRONICS CATEGORY BASED PRODUCTS AREA */}
      <Section6 data={electronicsProducts} />

      {/* SALES OFFER BANNERS AREA */}
      <Section7 />

      {/* MEN'S CATEGORY BASED PRODUCTS AREA */}
      <Section6 data={menFashionProducts} />

      {/* DISCOUNT OFFER BANNER AREA */}
      <Section8 />

      {/* WOMEN'S CATEGORY BASED PRODUCTS AREA */}
      <Section6 data={womenFashionProducts} />

      {/* FEATURES BRAND LIST AREA */}
      <Section9 brands={brands as any} />

      {/* SELECTED PRODUCTS AREA */}
      <Section10 products={products} />
    </Box>
  );
}
