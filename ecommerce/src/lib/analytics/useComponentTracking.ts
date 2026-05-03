"use client";

import { useEffect, useRef } from "react";

import { env } from "@/lib/env";

import { trackEvent } from "./trackEvent";
import { EVENT_SCHEMA_VERSION, type StructuralAnalyticsMetadata, type StructuralCTAContext, type StructuralCTAType } from "./eventSchema";

type ComponentTrackingInput = {
  pageType: string;
  componentType: string;
  componentId: string;
  tenantId?: string;
  ctaId?: string | null;
  ctaName?: string | null;
  ctaType?: StructuralCTAType | null;
  ctaContext?: StructuralCTAContext | null;
  ctaLocation?: string | null;
  position?: number | null;
  metadata?: StructuralAnalyticsMetadata;
  threshold?: number;
  once?: boolean;
};

export const useComponentTracking = ({
  pageType,
  componentType,
  componentId,
  tenantId = env.clientSlug,
  ctaId = null,
  ctaName = null,
  ctaType = null,
  ctaContext = null,
  ctaLocation = null,
  position = null,
  metadata,
  threshold = 0.35,
  once = true
}: ComponentTrackingInput) => {
  const ref = useRef<any>(null);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const element = ref.current;
    if (!element || hasTrackedRef.current) {
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      hasTrackedRef.current = true;
      void trackEvent({
        event_name: "component_view",
        event_category: "engagement",
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
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          if (once) {
            hasTrackedRef.current = true;
            observer.disconnect();
          }

          void trackEvent({
            event_name: "component_view",
            event_category: "engagement",
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
          break;
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [
    ctaContext,
    ctaId,
    ctaLocation,
    ctaName,
    ctaType,
    componentId,
    componentType,
    metadata,
    once,
    pageType,
    position,
    tenantId,
    threshold
  ]);

  return ref;
};
