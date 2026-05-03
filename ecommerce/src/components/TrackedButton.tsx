"use client";

import type { MouseEvent } from "react";

import { Button } from "@component/buttons";
import type { ButtonProps } from "@component/buttons/Button";
import { env } from "@/lib/env";

import { trackEvent } from "@/lib/analytics/trackEvent";
import {
  EVENT_SCHEMA_VERSION,
  type StructuralAnalyticsMetadata,
  type StructuralCTAContext,
  type StructuralCTAType,
  type StructuralEventCategory,
} from "@/lib/analytics/eventSchema";

type TrackedButtonProps = ButtonProps & {
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
  onTrackedClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  $active?: boolean;
};

export default function TrackedButton({
  eventName = "cta_click",
  eventCategory = "engagement",
  tenantId = env.clientSlug,
  pageType,
  componentType,
  componentId,
  ctaId,
  ctaName,
  ctaType = "primary",
  ctaContext = "ecommerce",
  ctaLocation,
  position,
  metadata,
  onClick,
  onTrackedClick,
  type = "button",
  disabled,
  ...props
}: TrackedButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
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
        console.warn("[tracked-button] analytics failed", error);
      }
    }

    onTrackedClick?.(event);
    onClick?.(event);
  };

  return <Button {...props} type={type} disabled={disabled} onClick={handleClick} />;
}
