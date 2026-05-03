import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { buildMediaRouteHref } from "@/lib/media-route";
import { getMediaUrl } from "@/lib/media";
import type { StorefrontProductMediaStoryItem } from "@/types/storefront";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";

type Props = {
  productSlug: string;
  stories: StorefrontProductMediaStoryItem[];
};

const railStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
  gap: "0.85rem",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
  textDecoration: "none",
  color: "inherit",
};

const thumbStyle: CSSProperties = {
  width: "92px",
  aspectRatio: "1 / 1",
  borderRadius: "999px",
  overflow: "hidden",
  border: "4px solid rgba(217, 164, 65, 0.35)",
  background:
    "radial-gradient(circle at top right, rgba(217, 164, 65, 0.2), transparent 32%), linear-gradient(135deg, rgba(18, 53, 45, 0.88), rgba(13, 24, 22, 0.95))",
  boxShadow: "0 12px 28px rgba(18, 53, 45, 0.12)",
};

export default function MultimediaStoriesRail({ productSlug, stories }: Props) {
  const railRef = useComponentTracking({
    pageType: "product",
    componentType: "multimedia_stories_rail",
    componentId: "multimedia_stories_rail",
    metadata: {
      product_slug: productSlug,
      story_count: stories.length,
    },
  });

  if (!stories.length) {
    return null;
  }

  return (
    <div ref={railRef} style={railStyle}>
      {stories.map((story) => {
        const href = buildMediaRouteHref(productSlug, story.mediaSlug);

        return (
          <Link
            key={story.id}
            href={href}
            scroll={false}
            style={cardStyle}
            aria-label={story.title}
            onClick={() => {
              void trackEvent({
                event_name: "select_item",
                event_category: "ecommerce",
                tenant_id: env.clientSlug,
                page_type: "product",
                component_type: "multimedia_stories_rail",
                component_id: "multimedia_stories_rail",
                cta_id: "multimedia.story.open",
                cta_name: "open_story",
                cta_type: "primary",
                cta_context: "content",
                cta_location: "multimedia_stories_rail",
                schema_version: EVENT_SCHEMA_VERSION,
                metadata: {
                  story_id: story.id,
                  story_title: story.title,
                  media_slug: story.mediaSlug,
                  product_slug: productSlug,
                },
                data: {
                  story_id: story.id,
                  story_title: story.title,
                  media_slug: story.mediaSlug,
                  product_slug: productSlug,
                },
              });
            }}>
            <div style={thumbStyle}>
              {story.type === "video" ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: "#f7f2e8",
                    background: "linear-gradient(135deg, rgba(18, 53, 45, 0.92), rgba(217, 164, 65, 0.35))",
                    fontWeight: 900,
                  }}
                >
                  ▶
                </div>
              ) : (
                <Image
                  src={getMediaUrl(story.public_id)}
                  alt={story.alt ?? story.title}
                  width={92}
                  height={92}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  unoptimized
                />
              )}
            </div>
            <strong style={{ fontSize: "0.92rem" }}>{story.title}</strong>
            {story.caption ? <span style={{ color: "#475569", fontSize: "0.88rem" }}>{story.caption}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
