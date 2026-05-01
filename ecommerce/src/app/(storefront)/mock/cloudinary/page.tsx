import type { Metadata } from "next";
import Image from "next/image";
import Container from "@component/Container";
import { getImageUrl, getVideoUrl, type CloudinaryStoredMedia } from "@/lib/cloudinary";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export const revalidate = 360;

const MEDIA_LIBRARY: CloudinaryStoredMedia[] = [
  { public_id: "ecommerce/showcase/hero-window", version: 1, type: "image", order: 1 },
  { public_id: "ecommerce/showcase/detail-fabric", version: 1, type: "image", order: 2 },
  { public_id: "ecommerce/showcase/install-demo", version: 1, type: "video", order: 3 },
];

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Cloudinary multimedia cache",
    description: "Galería ISR con URLs derivadas desde public_id, optimizadas para CDN y frontend cache.",
    canonicalPath: "/mock/cloudinary",
  });
}

const shellStyle = {
  padding: "64px 0",
  background:
    "radial-gradient(circle at top left, rgba(210, 162, 88, 0.18), transparent 25%), radial-gradient(circle at bottom right, rgba(20, 57, 48, 0.14), transparent 28%)",
};

const gridStyle = {
  display: "grid",
  gap: "24px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const cardStyle = {
  borderRadius: "28px",
  overflow: "hidden",
  background: "rgba(255, 255, 255, 0.9)",
  border: "1px solid rgba(17, 33, 29, 0.08)",
  boxShadow: "0 30px 70px rgba(16, 32, 28, 0.08)",
};

const imageShellStyle = {
  position: "relative" as const,
  aspectRatio: "4 / 3",
  background: "#edf4f0",
};

const videoStyle = {
  width: "100%",
  display: "block",
  background: "#0f172a",
};

const contentStyle = {
  padding: "20px",
  display: "grid",
  gap: "8px",
};

export default function CloudinaryDemoPage() {
  const images = MEDIA_LIBRARY.filter((asset) => asset.type === "image");
  const video = MEDIA_LIBRARY.find((asset) => asset.type === "video") ?? null;

  return (
    <Container>
      <main style={shellStyle}>
        <section style={{ maxWidth: "1120px", margin: "0 auto", padding: "0 16px" }}>
          <div style={{ marginBottom: "28px" }}>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#6b7f76",
              }}
            >
              Cloudinary cache flow
            </p>
            <h1 style={{ margin: "12px 0 0", fontSize: "clamp(2rem, 4vw, 3.8rem)", lineHeight: 1.02 }}>
              Multimedia served from `public_id`, not from stored URLs
            </h1>
            <p style={{ margin: "14px 0 0", maxWidth: "760px", color: "#4b5b54", fontSize: "1.05rem" }}>
              The page is static-revalidated, the assets are transformed on Cloudinary, and the
              browser only receives deterministic URLs for the requested width.
            </p>
          </div>

          <div style={gridStyle}>
            {images.map((asset) => {
              const src = getImageUrl(asset.public_id, { version: asset.version, size: "zoom" });
              return (
                <article key={asset.public_id} style={cardStyle}>
                  <div style={imageShellStyle}>
                    <Image
                      src={src}
                      alt={asset.public_id.replace(/\//g, " ")}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div style={contentStyle}>
                    <strong style={{ fontSize: "1rem" }}>{asset.public_id}</strong>
                    <span style={{ color: "#64748b", fontSize: "0.92rem" }}>v1 w_1200 f_auto q_auto</span>
                  </div>
                </article>
              );
            })}

            {video ? (
              <article style={cardStyle}>
                <video
                  controls
                  preload="metadata"
                  playsInline
                  style={videoStyle}
                  poster={getImageUrl("ecommerce/showcase/install-demo-poster", { version: 1, size: "zoom" })}
                >
                  <source src={getVideoUrl(video.public_id, { version: video.version, format: "mp4" })} type="video/mp4" />
                </video>
                <div style={contentStyle}>
                  <strong style={{ fontSize: "1rem" }}>{video.public_id}</strong>
                  <span style={{ color: "#64748b", fontSize: "0.92rem" }}>
                    Lazy-loaded video with metadata prefetch only
                  </span>
                </div>
              </article>
            ) : null}
          </div>
        </section>
      </main>
    </Container>
  );
}
