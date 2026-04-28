import { env } from "@/lib/env";
import { getAnalyticsContext } from "./session";

export type TrackPayload = {
  event: string;
  data?: Record<string, unknown>;
};

const getAnalyticsEndpoint = () => {
  try {
    return new URL("events", `${env.publicAnalyticsApiBaseUrl.replace(/\/?$/, "/")}`).toString();
  } catch {
    return "/api/analytics/events";
  }
};

const getNavigatorUserAgent = () => {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  return navigator.userAgent;
};

const getCurrentUrl = () => {
  if (typeof window === "undefined" || !window.location) {
    return "";
  }

  return window.location.href;
};

export const track = ({ event, data = {} }: TrackPayload) => {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof window.location === "undefined" || typeof window.navigator === "undefined") {
    return;
  }

  const context = getAnalyticsContext();
  const inferredValue =
    typeof data.value === "number"
      ? data.value
      : typeof data.ecommerce === "object" &&
          data.ecommerce &&
          "value" in data.ecommerce &&
          typeof (data.ecommerce as { value?: unknown }).value === "number"
        ? ((data.ecommerce as { value: number }).value ?? null)
        : null;

  const payload = {
    event,
    page: context.page,
    path: context.path,
    session_id: context.session_id,
    referrer: context.referrer,
    utm_source: context.utm_source,
    utm_medium: context.utm_medium,
    utm_campaign: context.utm_campaign,
    device: context.device,
    country: context.country,
    value: inferredValue,
    data,
    timestamp: new Date().toISOString(),
    url: getCurrentUrl(),
    user_agent: getNavigatorUserAgent(),
  };

  const body = JSON.stringify(payload);
  const endpoint = getAnalyticsEndpoint();

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon(endpoint, blob);
    if (!sent) {
      void fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => undefined);
    }
  } else {
    void fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  }

  if ((window as Window & { gtag?: (...args: unknown[]) => void }).gtag) {
    (window as Window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", event, data);
  }
};
