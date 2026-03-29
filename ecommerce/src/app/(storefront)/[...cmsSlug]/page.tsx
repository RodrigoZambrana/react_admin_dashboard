import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CmsPageShell from "@/components/cms/CmsPageShell";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

type PageProps = {
  params: Promise<{
    cmsSlug?: string[];
  }>;
};

const joinPath = async (params: PageProps["params"]) => {
  const resolved = await params;
  return (resolved.cmsSlug ?? []).join("/");
};

export const revalidate = 120;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const path = await joinPath(params);
  const { StorefrontApi } = await import("@/lib/api/storefront");
  try {
    const page = await StorefrontApi.getCmsPage(path);
    return buildStorefrontPageMetadata({
      title: page.seo?.title ?? page.title,
      description: page.seo?.description ?? page.summary ?? undefined,
    });
  } catch {
    return buildStorefrontPageMetadata();
  }
}

export default async function CmsCatchAllPage({ params }: PageProps) {
  const path = await joinPath(params);
  const { StorefrontApi } = await import("@/lib/api/storefront");
  try {
    const page = await StorefrontApi.getCmsPage(path);
    return <CmsPageShell page={page} />;
  } catch {
    notFound();
  }
}
