import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import MultimediaGallery from "@/components/multimedia/MultimediaGallery";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import { normalizeMediaSlug } from "@/lib/media-route";
import type { StorefrontProductMediaResponse } from "@/types/storefront";

export const revalidate = 300;

const loadMultimediaDetail = cache(async (slug: string): Promise<StorefrontProductMediaResponse | null> => {
  try {
    return await StorefrontApi.getProductMedia(slug, slug);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; mediaSlug: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const data = await loadMultimediaDetail(resolved.slug);

  if (!data) {
    return buildStorefrontPageMetadata({
      title: "Multimedia no encontrada",
      description: "No pudimos resolver la galería multimedia solicitada.",
      canonicalPath: `/multimedia/${resolved.slug}/${resolved.mediaSlug}`,
      noIndex: true,
    });
  }

  return buildStorefrontPageMetadata({
    title: `${data.product.name} · ${resolved.mediaSlug}`,
    description: `Detalle multimedia de ${data.product.name}.`,
    canonicalPath: `/multimedia/${resolved.slug}/${resolved.mediaSlug}`,
  });
}

export default async function MultimediaItemPage({
  params,
}: {
  params: Promise<{ slug: string; mediaSlug: string }>;
}) {
  const resolved = await params;
  const data = await loadMultimediaDetail(resolved.slug);

  if (!data) {
    notFound();
  }

  const normalizedMediaSlug = normalizeMediaSlug(resolved.mediaSlug);
  const hasMedia = data.media.some((item, index) => {
    const candidate = normalizeMediaSlug(
      item.slug || item.familyKey || item.name || `${item.type === "video" ? "video" : "imagen"}_${index + 1}`,
    );
    return candidate === normalizedMediaSlug;
  });

  if (!hasMedia) {
    notFound();
  }

  return (
    <main
      style={{
        display: "grid",
        gap: "1.5rem",
        padding: "clamp(1.25rem, 2.5vw, 2rem)",
      }}
    >
      <MultimediaGallery data={data} selectedMediaSlug={normalizedMediaSlug} />
    </main>
  );
}
