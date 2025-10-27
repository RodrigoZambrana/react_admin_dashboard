import Box from "@component/Box";
// PAGE SECTION COMPONENTS
import Section1 from "@sections/fashion-3/section-1";
import Section2 from "@sections/fashion-3/section-2";
import Section3 from "@sections/fashion-3/section-3";
import Section4 from "@sections/fashion-3/section-4";
import Section5 from "@sections/fashion-3/section-5";
import Section6 from "@sections/fashion-3/section-6";
import Section7 from "@sections/fashion-3/section-7";
import Section8 from "@sections/fashion-3/section-8";

export default async function FashionThree() {
  return (
    <Box bg="white" pb="4rem">
      {/* HERO CAROUSEL AREA */}
      <Section1 />

      {/* MEN AND WOMEN OFFERS AREA */}
      <Section2 />

      {/* BEST SELLING PRODUCTS AREA */}
      <Section3 />

      {/* TOP CATEGORIES AREA */}
      <Section4 />

      {/* SALE OFFER BANNERS AREA */}
      <Section5 />

      {/* FEATURED PRODUCTS AREA */}
      <Section6 />

      {/* SERVICE LIST AREA */}
      <Section7 />

      {/* BLOG LIST AREA */}
      <Section8 />
    </Box>
  );
}
