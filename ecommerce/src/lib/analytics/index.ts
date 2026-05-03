import type { StorefrontConfig } from "@/types/storefront";

import { getAnalyticsContext, getSessionId, type AnalyticsContext } from "./session";
export { trackEvent } from "./trackEvent";
export * from "./eventSchema";

export type AnalyticsRuntime = {
  analytics?: string | null;
  tagManager?: string | null;
  ads?: string | null;
};

export type OrderAnalyticsContext = AnalyticsContext & {
  source_event?: string | null;
};

export const resolveAnalyticsRuntime = (config: StorefrontConfig): AnalyticsRuntime => ({
  analytics: config.integrations?.google?.analytics?.measurementId?.trim() || null,
  tagManager: config.integrations?.google?.tagManager?.enabled
    ? config.integrations?.google?.tagManager?.containerId?.trim() || null
    : null,
  ads: config.integrations?.google?.ads?.enabled
    ? config.integrations?.google?.ads?.conversionId?.trim() || null
    : null,
});

export { getAnalyticsContext, getSessionId };
