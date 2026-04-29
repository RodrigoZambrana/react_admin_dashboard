import { env } from "@/lib/env";
import { getAnalyticsContext, hasAnalyticsConsent } from "./session";

export type TrackPayload = {
  event: string;
  data?: Record<string, unknown>;
};

export const createEventId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `event-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const toMetaEventName = (event: string) => {
  switch (event) {
    case "page_view":
      return "PageView";
    case "view_item":
      return "ViewContent";
    case "form_submit":
    case "lead_created":
      return "Lead";
    case "purchase":
    case "purchase_completed":
      return "Purchase";
    case "whatsapp_click":
    case "phone_click":
      return "Contact";
    case "add_to_cart":
      return "AddToCart";
    case "begin_checkout":
      return "InitiateCheckout";
    default:
      return event;
  }
};

const buildMetaCustomData = (event: string, data: Record<string, unknown>) => {
  if (event === "page_view") {
    return {};
  }

  const ecommerce = data.ecommerce as Record<string, unknown> | undefined;
  const items = Array.isArray(ecommerce?.items) ? ecommerce.items : [];
  const contentIds = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const candidate = record.item_id ?? record.id;
      return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : null;
    })
    .filter((value): value is string => Boolean(value));

  return {
    currency:
      typeof ecommerce?.currency === "string"
        ? ecommerce.currency
        : typeof data.currency === "string"
          ? data.currency
          : undefined,
    value:
      typeof ecommerce?.value === "number"
        ? ecommerce.value
        : typeof data.value === "number"
          ? data.value
          : undefined,
    content_ids: contentIds.length ? contentIds : undefined,
    content_type: contentIds.length ? "product" : undefined,
    num_items: contentIds.length || undefined,
    content_name:
      typeof ecommerce?.content_name === "string"
        ? ecommerce.content_name
        : typeof data.content_name === "string"
          ? data.content_name
          : undefined,
    order_id:
      typeof ecommerce?.transaction_id === "string"
        ? ecommerce.transaction_id
        : typeof data.transaction_id === "string"
          ? data.transaction_id
          : undefined,
  };
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
  const eventId =
    typeof data.event_id === "string" && data.event_id.trim().length > 0
      ? data.event_id
      : createEventId();
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
    event_id: eventId,
    page: context.page,
    path: context.path,
    session_id: context.session_id,
    referrer: context.referrer,
    utm_source: context.utm_source,
    utm_medium: context.utm_medium,
    utm_campaign: context.utm_campaign,
    device: context.device,
    country: context.country,
    fbp: context.fbp,
    fbc: context.fbc,
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

  const consentGranted = hasAnalyticsConsent();
  const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
  if (consentGranted && fbq) {
    const metaEvent = toMetaEventName(event);
    const metaData = buildMetaCustomData(event, data);
    try {
      fbq("track", metaEvent, metaData, { eventID: eventId });
    } catch {
      // Swallow Meta pixel runtime issues so analytics delivery stays non-blocking.
    }
  }

  return eventId;
};
