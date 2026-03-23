import type { Metadata } from "next";
import AppLayout from "@component/layout/layout-1";
import Navbar from "@component/navbar/Navbar";
import Section1 from "@sections/market-1/Section1";
import SectionStories from "@sections/market-1/SectionStories";
import Section2 from "@sections/market-1/Section2";
import Section5 from "@sections/market-1/Section5";
import Section6 from "@sections/market-1/Section6";
import Section8 from "@sections/market-1/Section8";
import Section10 from "@sections/market-1/Section10";
import Section12 from "@sections/market-1/Section12";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata();
}

export const revalidate = 300;
export const dynamic = "force-static";

export default async function StorefrontHomePage() {
  const { StorefrontApi } = await import("@/lib/api/storefront");
  const homeStoriesSection = await StorefrontApi.getContentSection("HOME_STORIES").catch(() => null);
  const stories = homeStoriesSection?.entries ?? [];

  return (
    <AppLayout navbar={<Navbar />}>
      <SectionStories stories={stories} />
      <Section1 />
      <Section10 />
      <Section12 />
      <Section2 />
      <Section5 />
      <Section6 />
      {/* <Section8 /> */}
    </AppLayout>
  );
}
