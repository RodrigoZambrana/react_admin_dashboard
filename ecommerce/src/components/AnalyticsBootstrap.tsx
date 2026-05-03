"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useOperationalSignals } from "@/lib/analytics/useOperationalSignals";

export default function AnalyticsBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string>("");

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (lastTrackedUrlRef.current === url) {
      return;
    }

    lastTrackedUrlRef.current = url;
    void trackEvent({
      event_name: "page_view",
      event_category: "navigation",
      tenant_id: env.clientSlug,
      page_type: resolvePageType(pathname),
      component_type: "page",
      component_id: "page_view_root",
      cta_id: null,
      cta_name: null,
      cta_type: null,
      cta_context: null,
      cta_location: null,
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        pathname,
        search: query || null,
        title: typeof document !== "undefined" ? document.title : null,
      },
      data: {
        pathname,
        search: query || null,
        title: typeof document !== "undefined" ? document.title : null,
      },
    });
  }, [pathname, searchParams]);

  useOperationalSignals({
    pageType: resolvePageType(pathname),
    pathname,
  });

  return null;
}
