"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";

import { getMediaUrl } from "@/lib/media";
import type { StorySummary } from "@/types/stories";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";

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
  minWidth: 0,
  flex: "0 0 auto",
  scrollSnapAlign: "start",
};

const buttonStyle: CSSProperties = {
  ...cardStyle,
  appearance: "none",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

const storyTitleStyle: CSSProperties = {
  width: "92px",
  textAlign: "center",
  fontSize: "0.86rem",
  lineHeight: 1.2,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "normal",
  minHeight: "2.4em",
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
  overflowX: "auto",
  overflowY: "hidden",
  justifyContent: "flex-start",
  scrollSnapType: "x proximity",
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none",
};

const railMobileStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  margin: 0,
  paddingInline: "0.25rem",
  transform: "none",
  transition: "none",
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
  const railStageRef = useRef<HTMLDivElement | null>(null);
  const storyStep = isCompact ? 104 : 106;
  const pathname = usePathname();
  const pageType = resolvePageType(pathname);
  const storiesRef = useComponentTracking({
    pageType,
    componentType: "stories_bar",
    componentId: "stories_bar_main",
    metadata: {
      story_count: stories.length,
    },
  });

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

  useLayoutEffect(() => {
    if (isCompact && railStageRef.current) {
      railStageRef.current.scrollLeft = 0;
    }
  }, [isCompact, orderedStories]);

  const rotate = (direction: "left" | "right") => {
    if (isCompact) {
      const stage = railStageRef.current;
      if (!stage) return;
      const delta = Math.max(96, Math.round(stage.clientWidth * 0.8));
      stage.scrollBy({
        left: direction === "right" ? delta : -delta,
        behavior: "smooth",
      });
      return;
    }

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
  const railResolved = isCompact
    ? { ...railStyle, ...railMobileStyle }
    : {
        ...railStyle,
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
    <section ref={storiesRef} style={shellStyle} aria-label="Historias">
      <div style={railShellResolved}>
        <button
          aria-label="Desplazar historias a la izquierda"
          onClick={() => {
            void trackEvent({
              event_name: "cta_click",
              event_category: "engagement",
              tenant_id: env.clientSlug,
              page_type: pageType,
              component_type: "stories_bar",
              component_id: "stories_bar_main",
              cta_id: "stories.nav.previous",
              cta_name: "navigate_previous",
              cta_type: "secondary",
              cta_context: "content",
              cta_location: "stories_bar",
              schema_version: EVENT_SCHEMA_VERSION,
              metadata: { direction: "left" },
              data: { direction: "left" },
            });
            rotate("left");
          }}
          style={navButtonResolved}
          type="button"
        >
          ‹
        </button>

        <div ref={railStageRef} style={railStageResolved}>
          <div style={railResolved} onTransitionEnd={onTrackTransitionEnd}>
            {orderedStories.map((story) =>
              onStorySelect ? (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => {
                    void trackEvent({
                      event_name: "select_item",
                      event_category: "ecommerce",
                      tenant_id: env.clientSlug,
                      page_type: pageType,
                      component_type: "stories_bar",
                      component_id: "stories_bar_main",
                      cta_id: "stories.story.open",
                      cta_name: "open_story",
                      cta_type: "primary",
                      cta_context: "content",
                      cta_location: "story_card",
                      schema_version: EVENT_SCHEMA_VERSION,
                      metadata: {
                        story_id: story.id,
                        story_slug: story.slug,
                        story_title: story.title,
                        position: index + 1,
                      },
                      data: {
                        story_id: story.id,
                        story_slug: story.slug,
                        story_title: story.title,
                        position: index + 1,
                      },
                    });
                    onStorySelect(story);
                  }}
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
                  <strong style={storyTitleStyle}>
                    {story.title}
                  </strong>
                </button>
              ) : (
                <Link
                  key={story.id}
                  href={`/stories/${encodeURIComponent(story.slug)}`}
                  onClick={() => {
                    void trackEvent({
                      event_name: "select_item",
                      event_category: "ecommerce",
                      tenant_id: env.clientSlug,
                      page_type: pageType,
                      component_type: "stories_bar",
                      component_id: "stories_bar_main",
                      cta_id: "stories.story.open",
                      cta_name: "open_story",
                      cta_type: "primary",
                      cta_context: "content",
                      cta_location: "story_card",
                      schema_version: EVENT_SCHEMA_VERSION,
                      metadata: {
                        story_id: story.id,
                        story_slug: story.slug,
                        story_title: story.title,
                      },
                      data: {
                        story_id: story.id,
                        story_slug: story.slug,
                        story_title: story.title,
                      },
                    });
                  }}
                  style={cardStyle}>
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
                  <strong style={storyTitleStyle}>
                    {story.title}
                  </strong>
                </Link>
              ),
            )}
          </div>
        </div>

        <button
          aria-label="Desplazar historias a la derecha"
          onClick={() => {
            void trackEvent({
              event_name: "cta_click",
              event_category: "engagement",
              tenant_id: env.clientSlug,
              page_type: pageType,
              component_type: "stories_bar",
              component_id: "stories_bar_main",
              cta_id: "stories.nav.next",
              cta_name: "navigate_next",
              cta_type: "secondary",
              cta_context: "content",
              cta_location: "stories_bar",
              schema_version: EVENT_SCHEMA_VERSION,
              metadata: { direction: "right" },
              data: { direction: "right" },
            });
            rotate("right");
          }}
          style={navButtonResolved}
          type="button"
        >
          ›
        </button>
      </div>
    </section>
  );
}
