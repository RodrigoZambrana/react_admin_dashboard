import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import AppLayout from "@/components/layout/layout-1";
import Container from "@component/Container";
import Navbar from "@component/navbar/Navbar";
import StoriesBar from "@/components/stories/StoriesBar";
import { StorefrontApi } from "@/lib/api/storefront";
import { env } from "@/lib/env";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";
import { getMediaUrl } from "@/lib/media";

export const revalidate = env.publicMediaProvider === "local" ? 0 : 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Historias",
    description: "Historias visuales del sitio, organizadas por contenido dinámico.",
    canonicalPath: "/stories",
  });
}

export default async function StoriesIndexPage() {
  const stories = await StorefrontApi.listStories().catch((error) => {
    console.warn("[stories] Failed to load stories index.", error);
    return [];
  });

  return (
    <AppLayout navbar={<Navbar />}>
      <Container my="2rem">
        <main
          style={{
            display: "grid",
            gap: "1.5rem",
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
              Stories
            </p>
            <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 4vw, 3.2rem)", lineHeight: 1.03, letterSpacing: "-0.05em" }}>
              Historias del sitio
            </h1>
            <p style={{ margin: 0, maxWidth: "72ch", color: "rgba(247, 242, 232, 0.78)", lineHeight: 1.65 }}>
              Cada historia se resuelve desde CMS y se reproduce con navegación secuencial, autoplay y CTA opcional.
            </p>
            <StoriesBar stories={stories} />
          </section>

          <section
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {stories.map((story) => (
              <Link
                key={story.id}
                href={`/stories/${encodeURIComponent(story.slug)}`}
                style={{
                  display: "grid",
                  gap: "0.75rem",
                  padding: "1rem",
                  borderRadius: "24px",
                  border: "1px solid rgba(17, 33, 29, 0.08)",
                  background: "#fff",
                  color: "#0f1413",
                  textDecoration: "none",
                  boxShadow: "0 18px 36px rgba(18, 53, 45, 0.08)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: "18px",
                    aspectRatio: "4 / 5",
                    background: "linear-gradient(180deg, rgba(18,53,45,0.12), rgba(217,164,65,0.12))",
                  }}
                >
                  <Image
                    alt={story.title}
                    fill
                    src={getMediaUrl(story.cover_public_id)}
                    sizes="(max-width: 768px) 100vw, 320px"
                    style={{ objectFit: "cover" }}
                    unoptimized
                  />
                </div>
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <strong style={{ fontSize: "1.05rem" }}>{story.title}</strong>
                  <span style={{ color: "#475569", fontSize: "0.9rem" }}>@{story.slug}</span>
                </div>
              </Link>
            ))}
            {!stories.length ? (
              <div
                style={{
                  padding: "1.2rem",
                  borderRadius: "20px",
                  border: "1px dashed rgba(17, 33, 29, 0.15)",
                  background: "rgba(255,255,255,0.7)",
                  color: "#475569",
                }}
              >
                No hay historias activas para mostrar.
              </div>
            ) : null}
          </section>
        </main>
      </Container>
    </AppLayout>
  );
}
