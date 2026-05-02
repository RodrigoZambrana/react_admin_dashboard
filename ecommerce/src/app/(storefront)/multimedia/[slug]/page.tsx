import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AppLayout from "@/components/layout/layout-1";
import Container from "@component/Container";
import Navbar from "@component/navbar/Navbar";
import MultimediaGallery from "@/components/multimedia/MultimediaGallery";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { env } from "@/lib/env";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import type { StorefrontProductMediaResponse } from "@/types/storefront";

export const revalidate = env.publicMediaProvider === "local" ? 0 : 300;

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
      title: "Colección no encontrada",
      description: "No pudimos resolver la colección visual solicitada.",
      canonicalPath: `/multimedia/${resolved.slug}`,
      noIndex: true,
    });
  }

  return buildStorefrontPageMetadata({
    title: `${data.product.name} · Inspiración visual`,
    description: `Explorá imágenes y videos reales de ${data.product.name} para elegir con más confianza.`,
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
