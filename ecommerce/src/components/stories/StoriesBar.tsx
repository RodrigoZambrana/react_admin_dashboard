"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { getMediaUrl } from "@/lib/media";
import type { StorySummary } from "@/types/stories";

type Props = {
  stories: StorySummary[];
  onStorySelect?: (story: StorySummary) => void;
};

const shellStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem 0",
  position: "relative",
};

const railShellStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "0.5rem",
};

const railStageStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  scrollbarWidth: "none",
  display: "flex",
  justifyContent: "center",
};

const railStyle: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "92px",
  gap: "0.9rem",
  width: "max-content",
  margin: "0 auto",
  paddingBottom: "0.15rem",
  willChange: "transform",
  transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
};

const cardStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "0.55rem",
  color: "inherit",
  textDecoration: "none",
};

const buttonStyle: CSSProperties = {
  ...cardStyle,
  appearance: "none",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

const ringStyle: CSSProperties = {
  width: "80px",
  height: "80px",
  padding: "3px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #12352d, #d9a441)",
  boxShadow: "0 12px 24px rgba(18, 53, 45, 0.16)",
};

const thumbStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  borderRadius: "999px",
  overflow: "hidden",
  border: "2px solid rgba(255,255,255,0.95)",
  background: "#f7f2e8",
};

const navButtonStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: "999px",
  background: "rgba(18, 53, 45, 0.94)",
  color: "#f7f2e8",
  boxShadow: "0 10px 20px rgba(18, 53, 45, 0.18)",
  cursor: "pointer",
};

const railShellMobileStyle: CSSProperties = {
  gap: "0.35rem",
};

const railStageMobileStyle: CSSProperties = {
  overflow: "hidden",
};

const railMobileStyle: CSSProperties = {
  gap: "0.75rem",
  margin: 0,
};

const navButtonMobileStyle: CSSProperties = {
  width: "36px",
  height: "36px",
};

export default function StoriesBar({ stories, onStorySelect }: Props) {
  const [isCompact, setIsCompact] = useState(false);
  const [orderedStories, setOrderedStories] = useState<StorySummary[]>(stories);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const directionRef = useRef<"left" | "right" | null>(null);
  const storyStep = isCompact ? 104 : 106;

  useEffect(() => {
    setOrderedStories(stories);
    setOffset(0);
    setAnimating(false);
    directionRef.current = null;
  }, [stories]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsCompact(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  const rotate = (direction: "left" | "right") => {
    if (animating || orderedStories.length < 2) return;

    directionRef.current = direction;
    setAnimating(true);
    setOffset(direction === "right" ? -storyStep : storyStep);
  };

  if (!stories.length) {
    return null;
  }

  const railShellResolved = isCompact ? { ...railShellStyle, ...railShellMobileStyle } : railShellStyle;
  const railStageResolved = isCompact ? { ...railStageStyle, ...railStageMobileStyle } : railStageStyle;
  const railResolved = {
    ...railStyle,
    ...railMobileStyle,
    transform: `translateX(${offset}px)`,
    transition: animating ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
  };
  const navButtonResolved = isCompact ? { ...navButtonStyle, ...navButtonMobileStyle } : navButtonStyle;

  const onTrackTransitionEnd = () => {
    if (!animating) return;

    const direction = directionRef.current;
    if (direction) {
      setOrderedStories((current) => {
        if (current.length < 2) return current;
        const next = [...current];
        if (direction === "right") {
          next.push(next.shift() as StorySummary);
        } else {
          next.unshift(next.pop() as StorySummary);
        }
        return next;
      });
    }

    setAnimating(false);
    directionRef.current = null;
    setOffset(0);
  };

  return (
    <section style={shellStyle} aria-label="Historias">
      <div style={railShellResolved}>
        <button
          aria-label="Desplazar historias a la izquierda"
          onClick={() => rotate("left")}
          style={navButtonResolved}
          type="button"
        >
          ‹
        </button>

        <div style={railStageResolved}>
          <div style={railResolved} onTransitionEnd={onTrackTransitionEnd}>
            {orderedStories.map((story) =>
              onStorySelect ? (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => onStorySelect(story)}
                  style={buttonStyle}
                >
                  <div style={ringStyle}>
                    <div style={thumbStyle}>
                      <Image
                        alt={story.title}
                        src={getMediaUrl(story.cover_public_id)}
                        fill
                        sizes="80px"
                        style={{ objectFit: "cover" }}
                        unoptimized
                      />
                    </div>
                  </div>
                  <strong
                    style={{
                      width: "92px",
                      textAlign: "center",
                      fontSize: "0.86rem",
                      lineHeight: 1.1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {story.title}
                  </strong>
                </button>
              ) : (
                <Link key={story.id} href={`/stories/${encodeURIComponent(story.slug)}`} style={cardStyle}>
                  <div style={ringStyle}>
                    <div style={thumbStyle}>
                      <Image
                        alt={story.title}
                        src={getMediaUrl(story.cover_public_id)}
                        fill
                        sizes="80px"
                        style={{ objectFit: "cover" }}
                        unoptimized
                      />
                    </div>
                  </div>
                  <strong
                    style={{
                      width: "92px",
                      textAlign: "center",
                      fontSize: "0.86rem",
                      lineHeight: 1.1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {story.title}
                  </strong>
                </Link>
              ),
            )}
          </div>
        </div>

        <button
          aria-label="Desplazar historias a la derecha"
          onClick={() => rotate("right")}
          style={navButtonResolved}
          type="button"
        >
          ›
        </button>
      </div>
    </section>
  );
}
