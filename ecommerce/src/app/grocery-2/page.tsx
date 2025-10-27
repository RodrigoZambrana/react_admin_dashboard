// API FUNCTIONS
import api from "@utils/__api__/grocery-2";
// GLOBAL CUSTOM COMPONENTS
import Box from "@component/Box";
import { Footer2 } from "@component/footer";
// PAGE SECTION COMPONENTS
import Wrapper from "@sections/grocery-2/Wrapper";
import SidenavBar from "@sections/grocery-2/SidenavBar";
import Section1 from "@sections/grocery-2/section-1";
import Section2 from "@sections/grocery-2/section-2";
import Section3 from "@sections/grocery-2/section-3";
import Section4 from "@sections/grocery-2/section-4";
import Section5 from "@sections/grocery-2/section-5";
import Section6 from "@sections/grocery-2/section-6";

export default async function GroceryTwo() {
  const [dairyProducts, navigationList, featuredProducts, bestHomeProducts, bestSellProducts] =
    await Promise.all([
      api.getDairyProducts(),
      api.getNavigationList(),
      api.getFeaturedProducts(),
      api.getBestHomeProducts(),
      api.getBestSellProducts()
    ]);

  return (
    <Wrapper>
      {/* SIDEBAR NAVIGATION AREA */}
      <Box className="sidenav" pt="1.5rem">
        <SidenavBar isFixedNave={true} navList={navigationList} />
      </Box>

      <Box className="content" pt="1.5rem">
        {/* HERO CAROUSEL AREA */}
        <Section1 />

        {/* SERVICES AREA */}
        <Box mb="3rem" overflow="hidden">
          <Section2 />
        </Box>

        {/* SHOP BY CATEGORY AREA */}
        <Box mb="3rem">
          <Section3 />
        </Box>

        {/* FEATURED PRODUCTS AREA */}
        <Box mb="3rem">
          <Section4 title="Featured Items" products={featuredProducts} />
        </Box>

        {/* BEST SELLER PRODUCTS AREA */}
        <Box mb="3rem">
          <Section4 title="Best Seller in Your Area" products={bestSellProducts} />
        </Box>

        {/* DISCOUNT BANNER CAROUSEL AREA */}
        <Box mb="3rem">
          <Section5 />
        </Box>

        {/* BEST HOME PRODUCTS AREA */}
        <Box mb="3rem">
          <Section4 title="Best of Home Essentials" products={bestHomeProducts} />
        </Box>

        {/* SNACK AND DRINKS PRODUCTS AREA */}
        <Box mb="3rem">
          <Section4 title="Snacks, Drinks, Dairy & More" products={dairyProducts} />
        </Box>

        {/* TESTIMONIAL CAROUSEL AREA */}
        <Box mb="3rem">
          <Section6 />
        </Box>

        {/* FOOTER AREA */}
        <Footer2 />
      </Box>
    </Wrapper>
  );
}
