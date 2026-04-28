import type { Metadata } from "next";
import LegacyStorefrontHomePage from "@/components/cms/LegacyStorefrontHomePage";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Tienda",
    description: "Explora la experiencia comercial actual del storefront.",
    canonicalPath: "/tienda",
  });
}

export const revalidate = 300;
export const dynamic = "force-static";

export default async function StorefrontLegacyLandingPage() {
  return <LegacyStorefrontHomePage />;
}
