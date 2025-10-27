import Box from "@component/Box";
// PAGE SECTION COMPONENTS
import Section1 from "@sections/fashion-2/section-1";
import Section2 from "@sections/fashion-2/section-2";
import Section3 from "@sections/fashion-2/section-3";
import Section4 from "@sections/fashion-2/section-4";
import Section5 from "@sections/fashion-2/section-5";
import Section6 from "@sections/fashion-2/section-6";
import Section7 from "@sections/fashion-2/section-7";
import Section8 from "@sections/fashion-2/section-8";
import Section9 from "@sections/fashion-2/section-9";
import Section10 from "@sections/fashion-2/section-10";

export default async function FashionTwo() {
  return (
    <Box bg="white">
      {/* HERO CAROUSEL AREA */}
      <Section1 />

      {/* SERVICES AREA */}
      <Section2 />

      {/* BEST SELLING CATEGORIES AREA */}
      <Section3 />

      {/* BEST SELLING PRODUCTS AREA */}
      <Section4 />

      {/* DISCOUNT OFFER BANNERS AREA */}
      <Section5 />

      {/* FEATURED PRODUCTS AREA */}
      <Section6 />

      {/* SUMMER SALE OFFER AREA */}
      <Section7 />

      {/* LATEST ARTICLES AREA */}
      <Section8 />

      {/* CLIENTS CAROUSEL AREA */}
      <Section9 />

      {/* SALE, LATEST, POPULAR PRODUCTS AREA */}
      <Section10 />
    </Box>
  );
}
