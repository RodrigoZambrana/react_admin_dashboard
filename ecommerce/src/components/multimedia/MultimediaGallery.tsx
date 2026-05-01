import Link from "next/link";
import type { CSSProperties } from "react";

import MultimediaViewer from "@/components/multimedia/MultimediaViewer";
import MultimediaStoriesRail from "@/components/multimedia/MultimediaStoriesRail";
import type { StorefrontProductMediaResponse } from "@/types/storefront";

type Props = {
  data: StorefrontProductMediaResponse;
  selectedMediaSlug?: string | null;
};

const shellStyle: CSSProperties = {
  display: "grid",
  gap: "1.25rem",
};

const profileCardStyle: CSSProperties = {
  display: "grid",
  gap: "1.1rem",
  padding: "clamp(1rem, 2vw, 1.4rem)",
  borderRadius: "28px",
  border: "1px solid rgba(17, 33, 29, 0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(249,247,243,0.98))",
  boxShadow: "0 18px 40px rgba(18, 53, 45, 0.08)",
};

const profileHeaderStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
};

const identityStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const avatarStyle: CSSProperties = {
  width: "3rem",
  height: "3rem",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  background: "linear-gradient(135deg, #12352d, #d9a441)",
  color: "#fff",
  boxShadow: "0 12px 24px rgba(18, 53, 45, 0.2)",
};

const statsRailStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "0.75rem",
};

const statCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.15rem",
  padding: "0.85rem 0.95rem",
  borderRadius: "18px",
  background: "rgba(18, 53, 45, 0.04)",
  border: "1px solid rgba(18, 53, 45, 0.08)",
};

export default function MultimediaGallery({ data, selectedMediaSlug = null }: Props) {
  const images = data.media.filter((item) => item.type === "image");
  const videos = data.media.filter((item) => item.type === "video");
  const reels = Math.min(1, videos.length);

  return (
    <section style={shellStyle}>
      <div style={profileCardStyle}>
        <div style={profileHeaderStyle}>
          <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
            <div style={avatarStyle}>{data.product.name.slice(0, 1).toUpperCase()}</div>
            <div style={identityStyle}>
              <p style={{ margin: 0, color: "#d9a441", fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Perfil multimedia
              </p>
              <h1 style={{ margin: 0, fontSize: "clamp(1.45rem, 3vw, 2.35rem)", lineHeight: 1.02, letterSpacing: "-0.05em" }}>
                {data.product.name}
              </h1>
              <p style={{ margin: 0, color: "#475569" }}>@{data.product.slug}</p>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            <Link
              href={`/product/${encodeURIComponent(data.product.slug)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "44px",
                padding: "0.8rem 1.1rem",
                borderRadius: "999px",
                border: "1px solid rgba(17, 33, 29, 0.12)",
                color: "#12352d",
                fontWeight: 700,
                textDecoration: "none",
                background: "#fff",
              }}
            >
              Ver producto
            </Link>
            <Link
              href="/multimedia"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "44px",
                padding: "0.8rem 1.1rem",
                borderRadius: "999px",
                background: "#12352d",
                color: "#f7f2e8",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Volver al listado
            </Link>
          </div>
        </div>

        <p style={{ margin: 0, color: "#475569", lineHeight: 1.65, maxWidth: "74ch" }}>
          Vista de perfil centrada en contenido visual: historias arriba y media grid como núcleo.
        </p>

        <div style={statsRailStyle}>
          <div style={statCardStyle}>
            <strong style={{ fontSize: "1.1rem" }}>Posts</strong>
            <span style={{ color: "#475569" }}>{data.media.length}</span>
          </div>
          <div style={statCardStyle}>
            <strong style={{ fontSize: "1.1rem" }}>Photos</strong>
            <span style={{ color: "#475569" }}>{images.length}</span>
          </div>
          <div style={statCardStyle}>
            <strong style={{ fontSize: "1.1rem" }}>Videos</strong>
            <span style={{ color: "#475569" }}>{videos.length}</span>
          </div>
          <div style={statCardStyle}>
            <strong style={{ fontSize: "1.1rem" }}>Reels</strong>
            <span style={{ color: "#475569" }}>{reels}</span>
          </div>
        </div>

        <MultimediaStoriesRail productSlug={data.product.slug} stories={data.stories ?? []} />

        <MultimediaViewer product={data.product} media={data.media} initialMediaSlug={selectedMediaSlug} />
      </div>
    </section>
  );
}
