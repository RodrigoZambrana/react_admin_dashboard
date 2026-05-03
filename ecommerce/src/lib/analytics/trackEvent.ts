"use client";

import { env } from "@/lib/env";

import { getAnalyticsContext } from "./session";
import { createEventId } from "./tracking";
import {
  EVENT_SCHEMA_VERSION,
  normalizeStructuralEventName,
  type StructuralAnalyticsEvent,
} from "./eventSchema";

const getAnalyticsEndpoint = () => {
  try {
    return new URL("events", `${env.publicAnalyticsApiBaseUrl.replace(/\/?$/, "/")}`).toString();
  } catch {
    return "/api/analytics/events";
  }
};

const pushToDataLayer = (payload: Record<string, unknown>) => {
  if (typeof window === "undefined") {
    return;
  }

  const globalWindow = window as Window & { dataLayer?: unknown[] };
  const dataLayer = globalWindow.dataLayer ?? [];
  globalWindow.dataLayer = dataLayer;
  dataLayer.push({
    event: payload.event_name,
    ...payload,
  });
};

const sendPayload = (payload: Record<string, unknown>) => {
  if (typeof window === "undefined") {
    return;
  }

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
    return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
};

export const trackEvent = (event: StructuralAnalyticsEvent) => {
  if (typeof window === "undefined") {
    return null;
  }

  if (typeof window.location === "undefined" || typeof window.navigator === "undefined") {
    return null;
  }

  const context = getAnalyticsContext();
  const canonicalEventName = normalizeStructuralEventName(event.event_name);
  const eventId = event.event_id?.trim() || createEventId();
  const payload = {
    ...event,
    event: event.event ?? canonicalEventName,
    event_name: canonicalEventName,
    event_id: eventId,
    tenant_id: event.tenant_id?.trim() || env.clientSlug || "default",
    schema_version: event.schema_version ?? EVENT_SCHEMA_VERSION,
    session_id: event.session_id ?? context.session_id,
    timestamp: event.timestamp?.trim() || new Date().toISOString(),
    page: event.page ?? context.page,
    path: event.path ?? context.path,
    referrer: event.referrer ?? context.referrer,
    utm_source: event.utm_source ?? context.utm_source,
    utm_medium: event.utm_medium ?? context.utm_medium,
    utm_campaign: event.utm_campaign ?? context.utm_campaign,
    device: event.device ?? context.device,
    country: event.country ?? context.country,
    url: event.url ?? window.location.href,
    user_agent: event.user_agent ?? navigator.userAgent,
    metadata: event.metadata ?? event.data ?? {},
    data: event.data ?? event.metadata ?? {},
  };

  pushToDataLayer(payload);
  sendPayload(payload);

  const gtagPayload = {
    ...payload.data,
    event_id: eventId,
    tenant_id: payload.tenant_id,
    schema_version: payload.schema_version,
    timestamp: payload.timestamp,
    page_type: payload.page_type,
    component_type: payload.component_type,
    component_id: payload.component_id,
    cta_id: payload.cta_id,
    cta_name: payload.cta_name,
    cta_type: payload.cta_type,
    cta_context: payload.cta_context,
    cta_location: payload.cta_location,
    position: payload.position,
  };

  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (gtag) {
    gtag("event", event.event_name, gtagPayload);
  }

  return eventId;
};
