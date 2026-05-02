"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { buildMediaRouteHref, buildMediaSlug } from "@/lib/media-route";
import { getMediaUrl } from "@/lib/media";
import type { StorefrontProductMediaItem } from "@/types/storefront";

type Props = {
  product: {
    id: number;
    slug: string;
    name: string;
  };
  media: StorefrontProductMediaItem[];
  initialMediaSlug?: string | null;
};

type MediaFilter = "all" | "image" | "video";

type NormalizedMediaItem = StorefrontProductMediaItem & {
  url: string;
  posterUrl: string | null;
  videoType: string | null;
};

const shellStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const tabsRailStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(96px, max-content))",
  gap: "0.5rem",
};

const tabButtonBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.7rem",
  minHeight: "42px",
  padding: "0.7rem 1rem",
  borderRadius: "999px",
  border: "1px solid rgba(17, 33, 29, 0.12)",
  background: "#fff",
  color: "#12352d",
  fontWeight: 800,
  cursor: "pointer",
};

const tabButtonActiveStyle: CSSProperties = {
  background: "#12352d",
  color: "#f7f2e8",
  border: "1px solid #12352d",
  boxShadow: "0 12px 24px rgba(18, 53, 45, 0.12)",
};

const galleryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(172px, 1fr))",
  gap: "0.45rem",
};

const compactGalleryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.35rem",
};

const mediaCardStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  aspectRatio: "1 / 1.28",
  borderRadius: 0,
  background: "transparent",
  border: 0,
  cursor: "pointer",
};

const mediaImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  display: "grid",
  placeItems: "center",
  padding: "1rem",
  background: "rgba(8, 13, 12, 0.78)",
  backdropFilter: "blur(12px)",
};

const modalDialogStyle: CSSProperties = {
  position: "relative",
  width: "min(1280px, calc(100vw - 2rem))",
  maxHeight: "calc(100vh - 2rem)",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.95fr)",
  overflow: "hidden",
  borderRadius: 0,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "#0f1514",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.38)",
};

const modalMediaPaneStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  minHeight: "min(72vh, 760px)",
  background:
    "radial-gradient(circle at top, rgba(217, 164, 65, 0.12), transparent 34%), linear-gradient(180deg, #0f1413 0%, #151d1b 100%)",
};

const modalMediaStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  minHeight: "min(72vh, 760px)",
  display: "grid",
  placeItems: "center",
};

const modalImageStyle: CSSProperties = {
  objectFit: "contain",
  objectPosition: "center",
  background: "transparent",
};

const modalVideoStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  maxHeight: "calc(100vh - 5rem)",
  objectFit: "cover",
  background: "#000",
};

const modalSidePaneStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1.25rem 1.25rem 1.15rem",
  background:
    "radial-gradient(circle at top right, rgba(217, 164, 65, 0.12), transparent 36%), linear-gradient(180deg, rgba(18, 28, 25, 0.98), rgba(13, 20, 18, 0.98))",
  color: "#f7f2e8",
};

const profileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const avatarStyle: CSSProperties = {
  width: "2.75rem",
  height: "2.75rem",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  color: "#f7f2e8",
  background: "linear-gradient(135deg, #12352d, #d9a441)",
  boxShadow: "0 12px 24px rgba(18, 53, 45, 0.18)",
};

const kickerStyle: CSSProperties = {
  margin: 0,
  color: "#d9a441",
  fontSize: "0.74rem",
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const sideTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.55rem, 2vw, 2.35rem)",
  lineHeight: 1.02,
  letterSpacing: "-0.05em",
  color: "#fff",
};

const sideCopyStyle: CSSProperties = {
  display: "grid",
  gap: "0.9rem",
};

const sideBenefitRailStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
};

const sideBenefitCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  padding: "0.85rem 0.9rem",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const sideNavRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  marginTop: "0.25rem",
};

const modalCounterStyle: CSSProperties = {
  position: "absolute",
  left: "1rem",
  bottom: "1rem",
  zIndex: 3,
  padding: "0.45rem 0.75rem",
  borderRadius: "999px",
  color: "#fff",
  fontSize: "0.8rem",
  fontWeight: 700,
  background: "rgba(15, 20, 19, 0.5)",
  backdropFilter: "blur(8px)",
};

const modalCloseStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  right: "1rem",
  zIndex: 3,
  display: "grid",
  placeItems: "center",
  width: "44px",
  height: "44px",
  border: 0,
  borderRadius: "999px",
  color: "#0f1413",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 16px 34px rgba(0, 0, 0, 0.22)",
  cursor: "pointer",
};

const modalNavStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  zIndex: 3,
  transform: "translateY(-50%)",
  border: 0,
  borderRadius: "999px",
  padding: "0.8rem 1rem",
  color: "#12352d",
  background: "rgba(247, 242, 232, 0.92)",
  fontWeight: 900,
  cursor: "pointer",
};

const modalPrevStyle: CSSProperties = {
  ...modalNavStyle,
  left: "1rem",
};

const modalNextStyle: CSSProperties = {
  ...modalNavStyle,
  right: "1rem",
};

const emptyStyle: CSSProperties = {
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px dashed rgba(17, 33, 29, 0.16)",
  background: "rgba(255,255,255,0.82)",
  color: "#475569",
};

const clampIndex = (value: number, size: number) => {
  if (!size) return 0;
  return ((value % size) + size) % size;
};

const getVideoMimeType = (value: string) => {
  const extension = `.${value.split(".").pop()?.toLowerCase() ?? ""}`
  if (extension === ".mov") return "video/quicktime"
  if (extension === ".m4v") return "video/x-m4v"
  if (extension === ".webm") return "video/webm"
  if (extension === ".ogv") return "video/ogg"
  return "video/mp4"
};

export default function MultimediaViewer({ product, media, initialMediaSlug = null }: Props) {
  const router = useRouter();
  const sortedMedia = useMemo(
    () => media.slice().sort((left, right) => left.order - right.order),
    [media],
  );

  const normalizedMedia = useMemo<NormalizedMediaItem[]>(() => {
    const firstImage = sortedMedia.find((item) => item.type === "image");
    const posterUrl = firstImage ? getMediaUrl(firstImage.public_id) : null;

    return sortedMedia.map((item) => ({
      ...item,
      url: getMediaUrl(item.public_id),
      posterUrl: item.type === "video" ? posterUrl : null,
      videoType: item.type === "video" ? getVideoMimeType(getMediaUrl(item.public_id)) : null,
      slug: buildMediaSlug(item, item.order),
    }));
  }, [sortedMedia]);

  const images = normalizedMedia.filter((item) => item.type === "image");
  const videos = normalizedMedia.filter((item) => item.type === "video");
  const commercialPoints = [
    "Elegí con más confianza gracias a imágenes y videos reales.",
    "Compará terminaciones, proporciones y estilo sin salir de la ficha.",
    "Encontrá la opción más adecuada para tu espacio y avanzá más rápido.",
  ];

  const [activeFilter, setActiveFilter] = useState<MediaFilter>("all");
  const [mounted, setMounted] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const filteredMedia = useMemo(() => {
    if (activeFilter === "image") return images;
    if (activeFilter === "video") return videos;
    return normalizedMedia;
  }, [activeFilter, images, normalizedMedia, videos]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateCompact = () => {
      setIsCompact(window.innerWidth < 768);
    };

    updateCompact();
    window.addEventListener("resize", updateCompact);
    return () => window.removeEventListener("resize", updateCompact);
  }, []);

  if (!filteredMedia.length) {
    return <div style={emptyStyle}>Este producto todavía no tiene imágenes ni videos asociados.</div>;
  }

  const activeIndex = useMemo(() => {
    if (!initialMediaSlug) {
      return null;
    }

    const normalizedInitialSlug = initialMediaSlug.trim().toLowerCase();
    const index = filteredMedia.findIndex((item, itemIndex) => buildMediaSlug(item, itemIndex).trim().toLowerCase() === normalizedInitialSlug);
    return index >= 0 ? index : null;
  }, [filteredMedia, initialMediaSlug]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeIndex]);

  const openMedia = (index: number) => {
    const item = filteredMedia[index];
    if (!item) return;
    router.push(buildMediaRouteHref(product.slug, buildMediaSlug(item, index)));
  };

  const closeModal = () => {
    router.push(`/multimedia/${encodeURIComponent(product.slug)}`);
  };

  const navigate = (direction: "prev" | "next") => {
    if (activeIndex === null) return;
    const nextIndex = clampIndex(direction === "next" ? activeIndex + 1 : activeIndex - 1, filteredMedia.length);
    openMedia(nextIndex);
  };

  const activeItem = activeIndex === null ? null : filteredMedia[clampIndex(activeIndex, filteredMedia.length)] ?? null;
  const activeModalIndex = activeIndex ?? 0;
  const dialogStyle: CSSProperties = isCompact
    ? {
        ...modalDialogStyle,
        width: "100vw",
        height: "100dvh",
        maxHeight: "100dvh",
        borderRadius: 0,
        gridTemplateColumns: "1fr",
        gridTemplateRows: "minmax(42svh, 54svh) auto",
        overflowY: "auto",
        overscrollBehavior: "contain",
      }
    : modalDialogStyle;
  const mediaPaneStyle: CSSProperties = isCompact
    ? {
        ...modalMediaPaneStyle,
        minHeight: "42svh",
        order: 0,
      }
    : modalMediaPaneStyle;
  const mediaStyle: CSSProperties = isCompact
    ? {
        ...modalMediaStyle,
        minHeight: "42svh",
      }
    : modalMediaStyle;
  const sidePaneStyle: CSSProperties = isCompact
    ? {
        ...modalSidePaneStyle,
        order: 1,
        padding: "0.85rem 0.85rem 1rem",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }
    : modalSidePaneStyle;
  const sideNavRowCompactStyle: CSSProperties = isCompact
    ? {
        ...sideNavRowStyle,
        position: "sticky",
        bottom: 0,
        marginTop: "0.25rem",
        paddingTop: "0.25rem",
        background: "linear-gradient(180deg, rgba(17, 24, 22, 0) 0%, rgba(17, 24, 22, 0.92) 34%)",
      }
    : sideNavRowStyle;
  const currentGalleryStyle = isCompact ? compactGalleryStyle : galleryStyle;

  return (
    <div style={shellStyle}>
      <div role="tablist" aria-label="Perfil multimedia" style={tabsRailStyle}>
        {[
          { key: "all" as const, label: "Todo" },
          { key: "image" as const, label: "Imágenes" },
          { key: "video" as const, label: "Videos" },
        ].map((filter) => {
          const isActive = filter.key === activeFilter;
          return (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(filter.key)}
              style={{
                ...tabButtonBaseStyle,
                ...(isActive ? tabButtonActiveStyle : {}),
              }}>
              <span>{filter.label}</span>
            </button>
          );
        })}
      </div>

      <div style={currentGalleryStyle}>
        {filteredMedia.map((item, index) => (
          <button
          key={`${item.public_id}-${item.order}-${item.slug ?? index}`}
          type="button"
          onClick={() => openMedia(index)}
          style={mediaCardStyle}>
            {item.type === "video" ? (
              <Image
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                src={item.posterUrl ?? item.url}
                unoptimized
                style={mediaImageStyle}
              />
            ) : (
              <Image
                alt={product.name}
                src={item.url}
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                unoptimized
                style={mediaImageStyle}
              />
            )}
          </button>
        ))}
      </div>

      {mounted && activeItem
        ? createPortal(
            <div
              aria-modal="true"
              onClick={closeModal}
              role="presentation"
              style={modalOverlayStyle}>
              <div
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                style={dialogStyle}>
                  <div style={mediaPaneStyle}>
                    <div style={mediaStyle}>
                      {activeItem.type === "video" ? (
                        <video
                          key={activeItem.url}
                          controls
                          autoPlay
                          muted
                          playsInline
                          poster={activeItem.posterUrl ?? undefined}
                          preload="metadata"
                          style={modalVideoStyle}>
                          <source src={activeItem.url} type={activeItem.videoType ?? "video/mp4"} />
                        </video>
                      ) : (
                        <Image
                          key={activeItem.url}
                          alt={product.name}
                          fill
                          priority
                          sizes="(max-width: 900px) 100vw, 70vw"
                          src={activeItem.url}
                          unoptimized
                          style={modalImageStyle}
                        />
                      )}
                    </div>

                    <button aria-label="Elemento anterior" onClick={() => navigate("prev")} style={modalPrevStyle} type="button">
                      ←
                    </button>
                    <button aria-label="Elemento siguiente" onClick={() => navigate("next")} style={modalNextStyle} type="button">
                      →
                    </button>
                    <button aria-label="Cerrar detalle" onClick={closeModal} style={modalCloseStyle} type="button">
                      ✕
                    </button>
                    <div style={modalCounterStyle}>
                      {clampIndex(activeModalIndex, filteredMedia.length) + 1} / {filteredMedia.length}
                    </div>
                  </div>
                  <div style={sidePaneStyle}>
                    <div style={profileRowStyle}>
                      <div style={avatarStyle}>{product.name.slice(0, 1).toUpperCase()}</div>
                      <div style={{ display: "grid", gap: "0.15rem" }}>
                        <strong style={{ color: "#fff" }}>urucortinas</strong>
                        <span style={{ color: "rgba(247, 242, 232, 0.72)", fontSize: "0.88rem" }}>
                          @{product.slug} · {buildMediaSlug(activeItem, activeModalIndex)} · {activeItem.type === "video" ? "video" : "foto"}
                        </span>
                      </div>
                    </div>

                    <div style={sideCopyStyle}>
                      <div>
                        <p style={kickerStyle}>Detalle comercial</p>
                        <h3 style={sideTitleStyle}>{product.name}</h3>
                      </div>
                      <p style={{ margin: 0, color: "rgba(247, 242, 232, 0.76)", lineHeight: 1.65 }}>
                        Una vista pensada para ayudarte a evaluar el producto con contexto real, antes de avanzar con tu compra o cotización.
                      </p>
                      <div style={sideBenefitRailStyle}>
                        {commercialPoints.map((point) => (
                          <div key={point} style={sideBenefitCardStyle}>
                            <strong style={{ color: "#fff", fontSize: "0.95rem" }}>Lo que te aporta</strong>
                            <span style={{ color: "rgba(247, 242, 232, 0.76)", lineHeight: 1.5 }}>{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={sideNavRowCompactStyle}>
                      <button
                        type="button"
                        onClick={() => navigate("prev")}
                        style={{
                          minHeight: "44px",
                          padding: "0.7rem 1rem",
                          borderRadius: "999px",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.04)",
                          color: "#f7f2e8",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}>
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("next")}
                        style={{
                          minHeight: "44px",
                          padding: "0.7rem 1rem",
                          borderRadius: "999px",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.04)",
                          color: "#f7f2e8",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}>
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
