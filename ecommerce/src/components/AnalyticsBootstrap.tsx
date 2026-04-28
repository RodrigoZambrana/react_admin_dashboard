"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { initAutoTracking, track } from "@/lib/analytics";

export default function AnalyticsBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string>("");

  useEffect(() => {
    return initAutoTracking();
  }, []);

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
    track({
      event: "page_view",
      data: {
        pathname,
        search: query || null,
        title: typeof document !== "undefined" ? document.title : null,
      },
    });
  }, [pathname, searchParams]);

  return null;
}
