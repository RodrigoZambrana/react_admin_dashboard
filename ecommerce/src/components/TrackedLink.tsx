"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import Link, { type LinkProps } from "next/link";

import { trackEvent } from "@/lib/analytics/trackEvent";
import {
  EVENT_SCHEMA_VERSION,
  type StructuralAnalyticsMetadata,
  type StructuralCTAContext,
  type StructuralCTAType,
  type StructuralEventCategory,
} from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";

type TrackedLinkProps = LinkProps & {
  children: ReactNode;
  eventName?: string;
  eventCategory?: StructuralEventCategory;
  tenantId?: string;
  pageType: string;
  componentType: string;
  componentId: string;
  ctaId: string;
  ctaName: string;
  ctaType?: StructuralCTAType;
  ctaContext?: StructuralCTAContext;
  ctaLocation?: string;
  position?: number | null;
  metadata?: StructuralAnalyticsMetadata;
  onTrackedClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  style?: CSSProperties;
};

export default function TrackedLink({
  children,
  eventName = "cta_click",
  eventCategory = "engagement",
  tenantId = env.clientSlug,
  pageType,
  componentType,
  componentId,
  ctaId,
  ctaName,
  ctaType = "primary",
  ctaContext = "content",
  ctaLocation,
  position,
  metadata,
  onClick,
  onTrackedClick,
  ...props
}: TrackedLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    try {
      trackEvent({
        event_name: eventName,
        event_category: eventCategory,
        tenant_id: tenantId ?? env.clientSlug ?? "default",
        page_type: pageType,
        component_type: componentType,
        component_id: componentId,
        cta_id: ctaId,
        cta_name: ctaName,
        cta_type: ctaType,
        cta_context: ctaContext,
        cta_location: ctaLocation,
        position,
        schema_version: EVENT_SCHEMA_VERSION,
        metadata,
        data: metadata,
      });
    } catch (error) {
      console.warn("[tracked-link] analytics failed", error);
    }

    onTrackedClick?.(event);
    onClick?.(event);
  };

  return (
    <Link {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}
