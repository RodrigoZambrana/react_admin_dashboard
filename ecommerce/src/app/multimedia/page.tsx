import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import MultimediaGrid from "@/components/multimedia/MultimediaGrid";
import { getMediaUrl } from "@/lib/media";
import { StorefrontApi } from "@/lib/api/storefront";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import type { ProductSummary } from "@/types/storefront";

export const revalidate = 300;

const loadMultimediaCatalog = cache(async (): Promise<ProductSummary[]> => {
  const catalog = await StorefrontApi.listProductsWithMedia();

  const mapped: Array<ProductSummary | null> = catalog
    .map((entry) => {
      const media = (entry.media ?? []).slice().sort((left, right) => left.order - right.order);
      if (!media.length) {
        return null;
      }

      const firstImage = media.find((item) => item.type === "image") ?? null;
      const imageItems = media.filter((item) => item.type === "image");
      const preview = firstImage ?? media[0] ?? null;

      const thumbnail = preview
        ? {
            id: `${entry.product.id}:${preview.public_id}`,
            url: getMediaUrl(preview.public_id),
            publicId: preview.public_id,
            alt: entry.product.name,
            sortOrder: preview.order,
            isPrimary: true,
          }
        : null;

      const images = imageItems.map((item) => ({
        id: `${entry.product.id}:${item.public_id}`,
        url: getMediaUrl(item.public_id),
        publicId: item.public_id,
        alt: entry.product.name,
        sortOrder: item.order,
        isPrimary: item.order === 0,
      }));

      return {
        id: entry.product.id,
        slug: entry.product.slug,
        name: entry.product.name,
        thumbnail,
        images,
        shortDescription: null,
        price: {
          amount: 0,
          currency: "UYU",
        },
        inventoryStatus: "in-stock",
      } as ProductSummary;
    })
    ;

  return mapped.filter((product): product is ProductSummary => product !== null);
});

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Multimedia",
    description: "Explorá el catálogo visual real de productos con imágenes y videos.",
    canonicalPath: "/multimedia",
  });
}

export default async function MultimediaPage() {
  const products = await loadMultimediaCatalog();

  return (
    <main
      style={{
        display: "grid",
        gap: "1.5rem",
        padding: "clamp(1.25rem, 2.5vw, 2rem)",
      }}
    >
      <section
        style={{
          display: "grid",
          gap: "0.85rem",
          padding: "clamp(1.25rem, 2vw, 2rem)",
          borderRadius: "28px",
          border: "1px solid rgba(17, 33, 29, 0.08)",
          background:
            "linear-gradient(135deg, rgba(18, 53, 45, 0.98) 0%, rgba(13, 24, 22, 0.98) 55%, rgba(14, 18, 17, 1) 100%)",
          color: "#f7f2e8",
          boxShadow: "0 24px 50px rgba(18, 53, 45, 0.16)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#d9a441",
            fontSize: "0.76rem",
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Multimedia real
        </p>
        <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 4vw, 3.2rem)", lineHeight: 1.03, letterSpacing: "-0.05em" }}>
          Productos con contenido visual
        </h1>
        <p style={{ margin: 0, maxWidth: "72ch", color: "rgba(247, 242, 232, 0.78)", lineHeight: 1.65 }}>
          Navegá el catálogo visual real sincronizado desde el backend local. Cada tarjeta abre la galería multimedia del producto.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link
            href="/shop"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              padding: "0.8rem 1.15rem",
              borderRadius: "999px",
              background: "#f7f2e8",
              color: "#12352d",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Ir a tienda
          </Link>
        </div>
      </section>

      <MultimediaGrid products={products} />
    </main>
  );
}
