"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import StoriesBar from "@/components/stories/StoriesBar";
import StoryViewer from "@/components/stories/StoryViewer";
import { StorefrontApi } from "@/lib/api/storefront";
import type { StoryDetail, StorySummary } from "@/types/stories";

type Props = {
  stories: StorySummary[];
};

const loadingShellStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  display: "grid",
  placeItems: "center",
  padding: "1rem",
  background:
    "radial-gradient(circle at top, rgba(217,164,65,0.16), transparent 30%), linear-gradient(180deg, #0f1413 0%, #141c1a 100%)",
  color: "#f7f2e8",
};

const loadingCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.85rem",
  justifyItems: "center",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  boxShadow: "0 28px 80px rgba(0,0,0,0.4)",
};

export default function StoriesHomeRail({ stories }: Props) {
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] ?? null : null;

  useEffect(() => {
    let mounted = true;

    if (!activeStory) {
      setStory(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    setStory(null);

    void StorefrontApi.getStory(activeStory.slug)
      .then((data) => {
        if (mounted) {
          setStory(data);
        }
      })
      .catch((error) => {
        console.warn("[stories] Failed to load story detail.", error);
        if (mounted) {
          setActiveStoryIndex(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeStory]);

  useEffect(() => {
    if (activeStoryIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeStoryIndex]);

  const portal = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }

    if (activeStoryIndex === null) {
      return null;
    }

    if (loading) {
      return createPortal(
        <div aria-live="polite" style={loadingShellStyle}>
          <div style={loadingCardStyle}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "999px",
                border: "3px solid rgba(247,242,232,0.2)",
                borderTopColor: "#d9a441",
              }}
            />
            <strong style={{ fontSize: "1rem" }}>Cargando historia…</strong>
          </div>
        </div>,
        document.body,
      );
    }

    if (!story) {
      return null;
    }

    const advanceStory = (direction: "prev" | "next") => {
      setActiveStoryIndex((current) => {
        if (current === null) {
          return current;
        }

        const nextIndex = direction === "next" ? current + 1 : current - 1;
        if (nextIndex >= 0 && nextIndex < stories.length) {
          return nextIndex;
        }

        setStory(null);
        return null;
      });

      return true;
    };

    return createPortal(
      <StoryViewer
        story={story}
        mode="overlay"
        onAdvanceStory={advanceStory}
        onClose={() => setActiveStoryIndex(null)}
      />,
      document.body,
    );
  }, [activeStoryIndex, loading, story, stories]);

  return (
    <>
      <StoriesBar
        stories={stories}
        onStorySelect={(selected) => {
          const index = stories.findIndex((item) => item.slug === selected.slug)
          setActiveStoryIndex(index >= 0 ? index : null)
        }}
      />
      {portal}
    </>
  );
}
