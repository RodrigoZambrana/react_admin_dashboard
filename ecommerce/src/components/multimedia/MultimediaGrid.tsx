import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import type { ProductSummary } from "@/types/storefront";

type Props = {
  products: ProductSummary[];
};

const shellStyle: CSSProperties = {
  display: "grid",
  gap: "1.15rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.9rem",
  padding: "0.9rem",
  borderRadius: "24px",
  border: "1px solid rgba(17, 33, 29, 0.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(250,248,244,0.96))",
  boxShadow: "0 18px 38px rgba(18, 53, 45, 0.08)",
  textDecoration: "none",
  color: "inherit",
};

const previewStyle: CSSProperties = {
  position: "relative",
  minHeight: "220px",
  overflow: "hidden",
  borderRadius: "18px",
  background:
    "radial-gradient(circle at top right, rgba(217, 164, 65, 0.16), transparent 32%), linear-gradient(135deg, rgba(18, 53, 45, 0.9), rgba(13, 24, 22, 0.95))",
};

const placeholderStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  height: "100%",
  color: "rgba(247, 242, 232, 0.78)",
  fontSize: "0.95rem",
  letterSpacing: "0.02em",
};

const copyStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

export default function MultimediaGrid({ products }: Props) {
  if (!products.length) {
    return (
      <div
        style={{
          padding: "2rem",
          borderRadius: "24px",
          border: "1px dashed rgba(17, 33, 29, 0.16)",
          background: "rgba(255,255,255,0.82)",
          color: "#475569",
        }}
      >
        Todavía estamos preparando la colección visual.
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={gridStyle}>
        {products.map((product, index) => {
          const preview = product.thumbnail?.url ?? product.images?.[0]?.url ?? null;
          const description = product.shortDescription?.trim() || "Explorá la galería visual del producto.";

          return (
            <Link key={product.id} href={`/multimedia/${encodeURIComponent(product.slug)}`} style={cardStyle}>
              <div style={previewStyle}>
                {preview ? (
                  <Image
                    src={preview}
                    alt={product.thumbnail?.alt ?? product.name}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 768px) 100vw, 360px"
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <div style={placeholderStyle}>Multimedia no disponible</div>
                )}
              </div>

              <div style={copyStyle}>
                <p
                  style={{
                    margin: 0,
                    color: "#d9a441",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Inspiración visual
                </p>
                <h3 style={{ margin: 0, fontSize: "1.08rem", lineHeight: 1.15, letterSpacing: "-0.03em" }}>
                  {product.name}
                </h3>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.55 }}>{description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
