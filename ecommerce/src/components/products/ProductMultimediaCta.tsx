"use client";

import Image from "next/image";
import Link from "next/link";

import type Product from "@models/product.model";

type Props = {
  product: Product;
};

const shellStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "24px",
  border: "1px solid rgba(17, 33, 29, 0.08)",
  background:
    "linear-gradient(135deg, rgba(18, 53, 45, 0.96) 0%, rgba(13, 24, 22, 0.98) 55%, rgba(14, 18, 17, 1) 100%)",
  color: "#f7f2e8",
  boxShadow: "0 24px 50px rgba(18, 53, 45, 0.16)",
};

const mediaStyle = {
  position: "relative" as const,
  overflow: "hidden",
  minHeight: "220px",
  borderRadius: "20px",
  background:
    "radial-gradient(circle at top right, rgba(217, 164, 65, 0.22), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
};

const copyStyle = {
  display: "grid",
  gap: "0.5rem",
};

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "0.65rem",
};

const primaryStyle = {
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
};

const secondaryStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0.8rem 1.15rem",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#f7f2e8",
  fontWeight: 700,
  textDecoration: "none",
};

export default function ProductMultimediaCta({ product }: Props) {
  const cover = product.thumbnail || product.images?.[0] || "";
  const multimediaDetailHref = `/multimedia/${encodeURIComponent(product.slug)}`;

  return (
    <section style={shellStyle}>
      <div style={mediaStyle}>
        {cover ? (
          <Image
            alt={product.title}
            src={cover}
            fill
            sizes="(max-width: 768px) 100vw, 520px"
            style={{ objectFit: "cover" }}
            priority={false}
          />
        ) : null}
      </div>

      <div style={copyStyle}>
        <p style={{ margin: 0, color: "#d9a441", fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Multimedia
        </p>
        <h2 style={{ margin: 0, fontSize: "clamp(1.35rem, 3vw, 2.2rem)", lineHeight: 1.05, letterSpacing: "-0.04em" }}>
          {product.title} en formato visual
        </h2>
        <p style={{ margin: 0, color: "rgba(247, 242, 232, 0.78)", lineHeight: 1.65, maxWidth: "62ch" }}>
          Accedé a historias, videos y publicaciones editoriales vinculadas al producto para reforzar decisión, inspiración y contexto visual.
        </p>
      </div>

      <div style={actionsStyle}>
        <Link href={multimediaDetailHref} style={primaryStyle}>
          Ver multimedia
        </Link>
        <Link href={`/product/${encodeURIComponent(product.slug)}`} style={secondaryStyle}>
          Volver al producto
        </Link>
      </div>
    </section>
  );
}
