import type { Metadata } from "next";
import CmsPageShell from "@/components/cms/CmsPageShell";
import StoriesHomeRail from "@/components/stories/StoriesHomeRail";
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
  const [page, homeContentSections, stories] = await Promise.all([
    StorefrontApi.getCmsPage(""),
    StorefrontApi.listContentSections().catch((error) => {
      console.warn("[storefront] Failed to load home content sections.", error);
      return [];
    }),
    StorefrontApi.listStories().catch((error) => {
      console.warn("[storefront] Failed to load stories rail.", error);
      return [];
    }),
  ]);

  return (
    <CmsPageShell
      page={page}
      homeContentSections={homeContentSections}
      homeTopSlot={<StoriesHomeRail stories={stories} />}
    />
  );
}
