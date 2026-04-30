import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CmsPageShell from "@/components/cms/CmsPageShell";
import { buildCmsPageMetadata, buildStorefrontPageMetadata } from "@/lib/page-metadata";
import StructuredData from "@/components/seo/StructuredData";
import { getStorefrontConfig } from "@/lib/storefront-config";
import {
  buildArticleJsonLd,
  buildCmsBreadcrumbs,
  buildCmsFaqJsonLd,
} from "@/lib/seo/structured-data";

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
    return buildCmsPageMetadata(page, path ? `/${path}` : "/");
  } catch {
    return buildStorefrontPageMetadata({ canonicalPath: path ? `/${path}` : "/" });
  }
}

export default async function CmsCatchAllPage({ params }: PageProps) {
  const path = await joinPath(params);
  const { StorefrontApi } = await import("@/lib/api/storefront");
  try {
    const page = await StorefrontApi.getCmsPage(path);
    const config = await getStorefrontConfig();
    const faqSchema = buildCmsFaqJsonLd(page);
    return (
      <>
        <StructuredData
          schemas={[
            buildArticleJsonLd(config, page),
            buildCmsBreadcrumbs(config, page),
            ...(faqSchema ? [faqSchema] : []),
          ]}
        />
        <CmsPageShell page={page} />
      </>
    );
  } catch {
    notFound();
  }
}
