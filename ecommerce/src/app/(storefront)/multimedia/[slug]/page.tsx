import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AppLayout from "@/components/layout/layout-1";
import Container from "@component/Container";
import Navbar from "@component/navbar/Navbar";
import MultimediaGallery from "@/components/multimedia/MultimediaGallery";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const data = await loadMultimediaDetail(resolved.slug);

  if (!data) {
    return buildStorefrontPageMetadata({
      title: "Multimedia no encontrada",
      description: "No pudimos resolver la galería multimedia solicitada.",
      canonicalPath: `/multimedia/${resolved.slug}`,
      noIndex: true,
    });
  }

  return buildStorefrontPageMetadata({
    title: `${data.product.name} · Multimedia`,
    description: `Galería multimedia real de ${data.product.name}.`,
    canonicalPath: `/multimedia/${resolved.slug}`,
  });
}

export default async function MultimediaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolved = await params;
  const data = await loadMultimediaDetail(resolved.slug);

  if (!data) {
    notFound();
  }

  return (
    <AppLayout navbar={<Navbar />}>
      <Container my="2rem">
        <main
          style={{
            display: "grid",
            gap: "1.5rem",
          }}
        >
          <MultimediaGallery data={data} />
        </main>
      </Container>
    </AppLayout>
  );
}
