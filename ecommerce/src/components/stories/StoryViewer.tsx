"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, TouchEvent } from "react";
import { useRouter } from "next/navigation";

import { getMediaUrl } from "@/lib/media";
import type { StoryDetail, StoryItem } from "@/types/stories";

type Props = {
  story: StoryDetail;
  onClose?: () => void;
  mode?: "page" | "overlay";
};

const shellStyle: CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "1rem",
  background:
    "radial-gradient(circle at top, rgba(217,164,65,0.16), transparent 30%), linear-gradient(180deg, #0f1413 0%, #141c1a 100%)",
  color: "#f7f2e8",
};

const overlayShellStyle: CSSProperties = {
  ...shellStyle,
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  minHeight: "100dvh",
};

const cardStyle: CSSProperties = {
  width: "min(1180px, 100%)",
  minHeight: "min(92vh, 920px)",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.85fr)",
  overflow: "hidden",
  borderRadius: "32px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#0f1413",
  boxShadow: "0 36px 96px rgba(0,0,0,0.44)",
};

const overlayCardStyle: CSSProperties = {
  ...cardStyle,
  width: "min(1280px, calc(100vw - 2rem))",
};

const compactPageCardStyle: CSSProperties = {
  ...cardStyle,
  width: "min(1180px, 100%)",
  minHeight: "auto",
  gridTemplateColumns: "1fr",
  gridTemplateRows: "minmax(42svh, 54svh) auto",
  borderRadius: "24px",
  boxShadow: "0 24px 72px rgba(0,0,0,0.36)",
};

const compactOverlayShellStyle: CSSProperties = {
  ...overlayShellStyle,
  padding: 0,
  placeItems: "stretch",
};

const compactOverlayCardStyle: CSSProperties = {
  ...compactPageCardStyle,
  width: "100vw",
  maxWidth: "100vw",
  minHeight: "100dvh",
  height: "100dvh",
  overflowX: "hidden",
  overflowY: "auto",
  borderRadius: 0,
  boxShadow: "none",
};

const mediaPaneStyle: CSSProperties = {
  position: "relative",
  minHeight: "min(92vh, 920px)",
  background:
    "radial-gradient(circle at top, rgba(217,164,65,0.16), transparent 34%), linear-gradient(180deg, #0f1413 0%, #151d1b 100%)",
  overflow: "hidden",
};

const overlayMediaPaneStyle: CSSProperties = {
  ...mediaPaneStyle,
  minHeight: "min(92vh, 920px)",
};

const compactMediaPaneStyle: CSSProperties = {
  ...mediaPaneStyle,
  minHeight: "42svh",
};

const sidePaneStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1.35rem",
  background:
    "radial-gradient(circle at top right, rgba(217,164,65,0.12), transparent 38%), linear-gradient(180deg, rgba(18,28,25,0.98), rgba(13,20,18,0.98))",
  borderLeft: "1px solid rgba(255,255,255,0.08)",
};

const overlaySidePaneStyle: CSSProperties = {
  ...sidePaneStyle,
};

const compactSidePaneStyle: CSSProperties = {
  ...sidePaneStyle,
  borderLeft: 0,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  padding: "1rem",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  alignItems: "center",
};

const avatarStyle: CSSProperties = {
  width: "2.6rem",
  height: "2.6rem",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  color: "#f7f2e8",
  background: "linear-gradient(135deg, #12352d, #d9a441)",
};

const closeButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  border: 0,
  background: "rgba(255,255,255,0.94)",
  color: "#0f1413",
  cursor: "pointer",
};

const progressRailStyle: CSSProperties = {
  position: "absolute",
  top: "0.75rem",
  left: "0.75rem",
  right: "0.75rem",
  zIndex: 3,
  display: "grid",
  gridAutoFlow: "column",
  gap: "0.35rem",
};

const progressTrackStyle: CSSProperties = {
  height: "3px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.2)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #f7f2e8, #d9a441)",
  transition: "width 120ms linear",
};

const contentStyle: CSSProperties = {
  display: "grid",
  gap: "0.9rem",
};

const mediaStageStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
};

const imageStyle: CSSProperties = {
  objectFit: "contain",
  objectPosition: "center",
};

const videoStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "contain",
  background: "#000",
};

const tapZoneStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: "50%",
  border: 0,
  background: "transparent",
  cursor: "pointer",
  zIndex: 2,
};

const textStyle: CSSProperties = {
  margin: 0,
  color: "rgba(247,242,232,0.74)",
  lineHeight: 1.6,
};

const clampIndex = (value: number, size: number) => {
  if (!size) return 0;
  return ((value % size) + size) % size;
};

const isExternal = (href: string) => /^(https?:\/\/|mailto:|tel:)/i.test(href);

const getItemDuration = (item: StoryItem) => Math.max(1000, item.duration ?? 5000);

export default function StoryViewer({ story, onClose, mode = "page" }: Props) {
  const router = useRouter();
  const items = useMemo(() => story.items.slice().sort((left, right) => left.order - right.order), [story.items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);

  const activeItem = items[clampIndex(activeIndex, items.length)] ?? null;
  const activeDuration = Math.max(1000, activeItem?.duration ?? 5000);
  const shellStyleResolved =
    mode === "overlay" && isCompact ? compactOverlayShellStyle : mode === "overlay" ? overlayShellStyle : shellStyle;
  const cardStyleResolved =
    mode === "overlay" && isCompact ? compactOverlayCardStyle : isCompact ? compactPageCardStyle : mode === "overlay" ? overlayCardStyle : cardStyle;
  const mediaPaneStyleResolved =
    isCompact ? compactMediaPaneStyle : mode === "overlay" ? overlayMediaPaneStyle : mediaPaneStyle;
  const sidePaneStyleResolved =
    isCompact ? compactSidePaneStyle : mode === "overlay" ? overlaySidePaneStyle : sidePaneStyle;

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/stories");
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const update = () => setIsCompact(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    if (!items.length) {
      return;
    }
    setActiveIndex(0);
  }, [items.length, story.slug]);

  useEffect(() => {
    if (!activeItem) {
      return;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (paused) {
      if (startedAtRef.current !== null) {
        elapsedBeforePauseRef.current += Math.max(0, performance.now() - startedAtRef.current);
        startedAtRef.current = null;
      }
      return;
    }

    startedAtRef.current = performance.now();

    const tick = () => {
      const elapsed = elapsedBeforePauseRef.current + Math.max(0, performance.now() - (startedAtRef.current ?? performance.now()));
      const ratio = Math.min(1, elapsed / activeDuration);
      setProgress(ratio);
      if (ratio >= 1) {
        elapsedBeforePauseRef.current = 0;
        startedAtRef.current = null;
        setActiveIndex((current) => clampIndex(current + 1, items.length));
        return;
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };

    setProgress(Math.min(1, elapsedBeforePauseRef.current / activeDuration));
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [activeDuration, activeItem, items.length, paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeItem?.type !== "video") {
      return;
    }
    if (paused) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      // autoplay best effort
    });
  }, [activeItem, paused]);

  const go = (direction: "prev" | "next") => {
    elapsedBeforePauseRef.current = 0;
    startedAtRef.current = null;
    setProgress(0);
    setActiveIndex((current) => clampIndex(direction === "next" ? current + 1 : current - 1, items.length));
  };

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartX.current = null;
    if (startX === null || endX === null) {
      return;
    }
    const delta = endX - startX;
    if (Math.abs(delta) < 48) {
      return;
    }
    go(delta < 0 ? "next" : "prev");
  };

  if (!activeItem) {
    return null;
  }

  const nextItem = items[clampIndex(activeIndex + 1, items.length)] ?? null;

  return (
    <main style={shellStyleResolved}>
      <div
        aria-label={story.title}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={cardStyleResolved}
      >
        <div style={mediaPaneStyleResolved}>
          <div style={progressRailStyle}>
            {items.map((item, index) => {
              const width = index < activeIndex ? 100 : index === activeIndex ? progress * 100 : 0;
              return (
                <div key={item.id} style={progressTrackStyle}>
                  <div style={{ ...progressFillStyle, width: `${width}%` }} />
                </div>
              );
            })}
          </div>

          <div style={mediaStageStyle}>
            {activeItem.type === "video" ? (
              <video
                key={`${activeItem.public_id}:${activeIndex}`}
                ref={videoRef}
                autoPlay
                controls={false}
                muted
                playsInline
                preload="metadata"
                style={videoStyle}
                onEnded={() => go("next")}
              >
                <source src={getMediaUrl(activeItem.public_id)} />
              </video>
            ) : (
              <Image
                alt={activeItem.ctaLabel ?? story.title}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 70vw"
                src={getMediaUrl(activeItem.public_id)}
                unoptimized
                style={imageStyle}
              />
            )}

            <button aria-label="Anterior" onClick={() => go("prev")} style={{ ...tapZoneStyle, left: 0 }} type="button" />
            <button aria-label="Siguiente" onClick={() => go("next")} style={{ ...tapZoneStyle, right: 0 }} type="button" />

            <div
              style={{
                position: "absolute",
                bottom: "0.9rem",
                left: "0.9rem",
                right: "0.9rem",
                display: "flex",
                justifyContent: "flex-start",
                gap: "0.75rem",
                alignItems: "center",
                zIndex: 3,
              }}
            >
              <div
                style={{
                  padding: "0.45rem 0.7rem",
                  borderRadius: "999px",
                  background: "rgba(15,20,19,0.48)",
                  color: "#fff",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  backdropFilter: "blur(8px)",
                }}
              >
                {activeIndex + 1} / {items.length}
              </div>
            </div>
          </div>
        </div>

        <div style={sidePaneStyleResolved}>
          <div style={headerStyle}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <div style={avatarStyle}>{story.title.slice(0, 1).toUpperCase()}</div>
              <div style={{ display: "grid", gap: "0.1rem" }}>
                <strong>{story.title}</strong>
                <span style={{ color: "rgba(247,242,232,0.72)", fontSize: "0.88rem" }}>@{story.slug}</span>
              </div>
            </div>
            <button type="button" onClick={handleClose} style={closeButtonStyle}>
              ✕
            </button>
          </div>

          <div style={contentStyle}>
            <p style={{ margin: 0, color: "#d9a441", fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Historia
            </p>
            <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 2.2vw, 2.3rem)", lineHeight: 1.02, letterSpacing: "-0.05em" }}>
              {story.title}
            </h1>
            <p style={textStyle}>
              {activeItem.type === "video"
                ? "Reproducción automática activada. El slide avanza al finalizar el video."
                : `Cada imagen avanza automáticamente después de ${Math.round(getItemDuration(activeItem) / 1000)}s.`}
            </p>
            <p style={textStyle}>
              Si existe CTA en el item actual, se muestra debajo. El contenido se resuelve desde MEDIA_ROOT y no depende de productos.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
            }}
          >
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
              <strong>{items.length}</strong>
              <div style={{ color: "rgba(247,242,232,0.68)", fontSize: "0.84rem" }}>Slides</div>
            </div>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
              <strong>{items.filter((item) => item.type === "image").length}</strong>
              <div style={{ color: "rgba(247,242,232,0.68)", fontSize: "0.84rem" }}>Imágenes</div>
            </div>
              <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
                <strong>{items.filter((item) => item.type === "video").length}</strong>
                <div style={{ color: "rgba(247,242,232,0.68)", fontSize: "0.84rem" }}>Videos</div>
              </div>
            </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "auto" }}>
            <button
              type="button"
              onClick={() => go("prev")}
              style={{
                minHeight: "44px",
                padding: "0.7rem 1rem",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#f7f2e8",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => go("next")}
              style={{
                minHeight: "44px",
                padding: "0.7rem 1rem",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#f7f2e8",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Siguiente
            </button>
          </div>

          {activeItem.ctaUrl ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <Link
                href={activeItem.ctaUrl}
                target={isExternal(activeItem.ctaUrl) ? "_blank" : undefined}
                rel={isExternal(activeItem.ctaUrl) ? "noreferrer" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "44px",
                  padding: "0.8rem 1rem",
                  borderRadius: "999px",
                  background: "#f7f2e8",
                  color: "#12352d",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                {activeItem.ctaLabel || "Ver más"}
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {nextItem ? (
        <div aria-hidden="true" style={{ display: "none" }}>
          {nextItem.type === "video" ? (
            <video preload="metadata">
              <source src={getMediaUrl(nextItem.public_id)} />
            </video>
          ) : (
            <Image alt="" src={getMediaUrl(nextItem.public_id)} width={1} height={1} unoptimized />
          )}
        </div>
      ) : null}
    </main>
  );
}
