"use client";

import { useEffect, useRef } from "react";

import { env } from "@/lib/env";

import { trackEvent } from "./trackEvent";
import { EVENT_SCHEMA_VERSION } from "./eventSchema";
import type { AnalyticsPageType } from "./pageType";

type OperationalSignalsInput = {
  pageType: AnalyticsPageType;
  pathname: string;
};

const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 90];

const resolveScrollDepth = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 0;
  }

  const doc = document.documentElement;
  const scrollableHeight = Math.max(doc.scrollHeight - window.innerHeight, 1);
  const current = (window.scrollY / scrollableHeight) * 100;
  return Math.max(0, Math.min(100, current));
};

const resolveErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown error";
  }
};

export const useOperationalSignals = ({ pageType, pathname }: OperationalSignalsInput) => {
  const sessionStartedAtRef = useRef<number>(Date.now());
  const trackedDepthsRef = useRef<Set<number>>(new Set());
  const flushedTimeOnPageRef = useRef(false);

  useEffect(() => {
    sessionStartedAtRef.current = Date.now();
    trackedDepthsRef.current = new Set();
    flushedTimeOnPageRef.current = false;

    if (typeof window === "undefined") {
      return undefined;
    }

    const emitTimeOnPage = (reason: string) => {
      if (flushedTimeOnPageRef.current) {
        return;
      }

      flushedTimeOnPageRef.current = true;
      const elapsedSeconds = Number(((Date.now() - sessionStartedAtRef.current) / 1000).toFixed(2));

      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
        return;
      }

      void trackEvent({
        event_name: "time_on_page",
        event_category: "engagement",
        tenant_id: env.clientSlug,
        page_type: pageType,
        component_type: "page",
        component_id: "global_time_on_page",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          pathname,
          page_type: pageType,
          seconds: elapsedSeconds,
          reason,
        },
        data: {
          pathname,
          page_type: pageType,
          seconds: elapsedSeconds,
          reason,
        },
      });
    };

    const handleScroll = () => {
      const depth = resolveScrollDepth();
      for (const threshold of SCROLL_DEPTH_THRESHOLDS) {
        if (depth < threshold || trackedDepthsRef.current.has(threshold)) {
          continue;
        }

        trackedDepthsRef.current.add(threshold);
        void trackEvent({
          event_name: "scroll_depth",
          event_category: "engagement",
          tenant_id: env.clientSlug,
          page_type: pageType,
          component_type: "page",
          component_id: "global_scroll_tracker",
          schema_version: EVENT_SCHEMA_VERSION,
          metadata: {
            pathname,
            page_type: pageType,
            depth_percent: threshold,
            max_depth_percent: Number(depth.toFixed(2)),
          },
          data: {
            pathname,
            page_type: pageType,
            depth_percent: threshold,
            max_depth_percent: Number(depth.toFixed(2)),
          },
        });
      }
    };

    const handleError = (event: ErrorEvent) => {
      void trackEvent({
        event_name: "error_event",
        event_category: "system",
        tenant_id: env.clientSlug,
        page_type: pageType,
        component_type: "page",
        component_id: "global_error_listener",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          pathname,
          page_type: pageType,
          error_type: "window_error",
          message: event.message,
          filename: event.filename ?? null,
          line: event.lineno ?? null,
          column: event.colno ?? null,
        },
        data: {
          pathname,
          page_type: pageType,
          error_type: "window_error",
          message: event.message,
          filename: event.filename ?? null,
          line: event.lineno ?? null,
          column: event.colno ?? null,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      void trackEvent({
        event_name: "error_event",
        event_category: "system",
        tenant_id: env.clientSlug,
        page_type: pageType,
        component_type: "page",
        component_id: "global_error_listener",
        schema_version: EVENT_SCHEMA_VERSION,
        metadata: {
          pathname,
          page_type: pageType,
          error_type: "unhandled_rejection",
          message: resolveErrorMessage(reason),
        },
        data: {
          pathname,
          page_type: pageType,
          error_type: "unhandled_rejection",
          message: resolveErrorMessage(reason),
        },
      });
    };

    const handlePageLifecycle = () => emitTimeOnPage("pagehide");
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        emitTimeOnPage("visibilitychange");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageLifecycle);
    window.addEventListener("beforeunload", handlePageLifecycle);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageLifecycle);
      window.removeEventListener("beforeunload", handlePageLifecycle);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      emitTimeOnPage("cleanup");
    };
  }, [pageType, pathname]);
};
