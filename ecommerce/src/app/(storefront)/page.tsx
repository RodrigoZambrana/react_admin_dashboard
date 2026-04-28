import type { Metadata } from "next";
import CmsPageShell from "@/components/cms/CmsPageShell";
import LegacyStorefrontHomePage from "@/components/cms/LegacyStorefrontHomePage";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export const revalidate = 120;
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { StorefrontApi } = await import("@/lib/api/storefront");
  try {
    const page = await StorefrontApi.getCmsPage("");
    return buildStorefrontPageMetadata({
      title: page.seo?.title ?? page.title,
      description: page.seo?.description ?? page.summary ?? undefined,
      canonicalPath: "/",
    });
  } catch {
    return buildStorefrontPageMetadata({ canonicalPath: "/" });
  }
}

export default async function StorefrontRootPage() {
  const { StorefrontApi } = await import("@/lib/api/storefront");
  try {
    const page = await StorefrontApi.getCmsPage("");
    return <CmsPageShell page={page} />;
  } catch {
    return <LegacyStorefrontHomePage />;
  }
}
