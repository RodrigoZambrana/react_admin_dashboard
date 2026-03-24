import type { Metadata } from "next";
import loadable from "next/dynamic";
import AppLayout from "@component/layout/layout-1";
import Navbar from "@component/navbar/Navbar";
import Section1 from "@sections/market-1/Section1";
import SectionStories from "@sections/market-1/SectionStories";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

const SectionCmsHighlights = loadable(() => import("@sections/market-1/SectionCmsHighlights"));
const Section10 = loadable(() => import("@sections/market-1/Section10"));
const Section12 = loadable(() => import("@sections/market-1/Section12"));
const Section2 = loadable(() => import("@sections/market-1/Section2"));
const Section5 = loadable(() => import("@sections/market-1/Section5"));
const Section6 = loadable(() => import("@sections/market-1/Section6"));

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata();
}

export const revalidate = 300;
export const dynamic = "force-static";

export default async function StorefrontHomePage() {
  const { StorefrontApi } = await import("@/lib/api/storefront");
  const homeContentSections = await StorefrontApi.listContentSections().catch(
    (): import("@/types/storefront").CmsContentSection[] => [],
  );
  const homeStoriesSection = homeContentSections.find((section) => section.key === "HOME_STORIES") ?? null;
  const homeHighlightsSection =
    homeContentSections.find((section) => section.key === "HOME_HIGHLIGHTS") ?? null;
  const stories = homeStoriesSection?.entries ?? [];

  return (
    <AppLayout navbar={<Navbar />}>
      <SectionStories stories={stories} />
      <SectionCmsHighlights section={homeHighlightsSection} />
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
