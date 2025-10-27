// API FUNCTIONS
import api from "@utils/__api__/gadget";
// GLOBAL CUSTOM COMPONENTS
import Box from "@component/Box";
// PAGE SECTION COMPONENTS
import Section1 from "@sections/gadget-shop/section-1";
import Section2 from "@sections/gadget-shop/section-2";
import Section3 from "@sections/gadget-shop/section-3";
import Section4 from "@sections/gadget-shop/section-4";
import Section5 from "@sections/gadget-shop/section-5";
import Section6 from "@sections/gadget-shop/section-6";
import Section7 from "@sections/gadget-shop/section-7";

export default async function GadgetShop() {
  const [
    twoBanner,
    blogLists,
    topPickList,
    newArrivalsData,
    mostViewedList,
    mainCarouselData,
    featuredCategories
  ] = await Promise.all([
    api.getTwoBanner(),
    api.getBlogLists(),
    api.getTopPicksList(),
    api.getNewArrival(),
    api.getMostViewedList(),
    api.getMainCarousel(),
    api.getFeaturedCategories()
  ]);

  return (
    <Box my="2rem">
      {/* TOP PICKS AND NEW WINTER PRODUCTS CAROUSEL AREA */}
      <Section1 mainCarousel={mainCarouselData} topPickList={topPickList} />

      {/* FEATURED CATEGORIES AREA */}
      <Section2 categories={featuredCategories} />

      {/* DISCOUNT BANNERS AREA */}
      <Section3 bannerData={twoBanner} />

      {/* MOST VIEW PRODUCTS CAROUSEL AREA */}
      <Section4 products={mostViewedList} />

      {/* NEW ARRIVAL PRODUCTS CAROUSEL AREA */}
      <Section5 products={newArrivalsData} />

      {/* OFFER BANNER AREA */}
      <Section6 />

      {/* BLOGS AREA */}
      <Section7 blogs={blogLists} />
    </Box>
  );
}
