import AppLayout from "@component/layout/layout-1";
import Navbar from "@component/navbar/Navbar";
import Section1 from "@sections/market-1/Section1";
import Section2 from "@sections/market-1/Section2";
import Section5 from "@sections/market-1/Section5";
import Section6 from "@sections/market-1/Section6";
import Section8 from "@sections/market-1/Section8";
import Section10 from "@sections/market-1/Section10";
import Section12 from "@sections/market-1/Section12";
import Section9 from "@sections/fashion-2/section-9";

export const metadata = {
  title: "Storefront",
  description: "Configurable ecommerce storefront powered by the Bonik UI."
};

export default async function StorefrontHomePage() {
  return (
    <AppLayout navbar={<Navbar navListOpen />}>
      <Section1 />
      <Section10 />
      <Section12 />
      <Section2 />
      <Section5 />
      <Section6 />
      {/* <Section8 /> */}
      <Section9 />
    </AppLayout>
  );
}
