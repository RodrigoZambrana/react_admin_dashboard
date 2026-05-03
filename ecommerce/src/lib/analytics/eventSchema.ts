export const EVENT_SCHEMA_VERSION = 1 as const;

export type StructuralEventCategory = "navigation" | "ecommerce" | "engagement" | "conversion" | "system";
export type StructuralCTAType = "primary" | "secondary" | "tertiary";
export type StructuralCTAContext = "navigation" | "ecommerce" | "checkout" | "content";
export const STRUCTURAL_EVENT_NAMES = [
  "page_view",
  "component_view",
  "select_item",
  "view_item",
  "view_cart",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "purchase",
  "cta_click",
  "search",
  "scroll_depth",
  "time_on_page",
  "error_event",
  "filter_applied",
  "sort_applied",
] as const;
export type StructuralEventName = (typeof STRUCTURAL_EVENT_NAMES)[number];

export type StructuralAnalyticsMetadata = Record<string, unknown>;

export const normalizeStructuralEventName = (value: string): StructuralEventName | string => {
  if (STRUCTURAL_EVENT_NAMES.includes(value as StructuralEventName)) {
    return value as StructuralEventName;
  }
  return value;
};

export type StructuralAnalyticsEvent = {
  event?: string;
  event_name: string;
  event_category: StructuralEventCategory;
  tenant_id: string;
  session_id?: string;
  user_id?: string | null;
  page_type: string;
  component_type?: string | null;
  component_id?: string | null;
  cta_id?: string | null;
  cta_name?: string | null;
  cta_type?: StructuralCTAType | null;
  cta_context?: StructuralCTAContext | null;
  cta_location?: string | null;
  position?: number | null;
  schema_version?: number;
  event_id?: string;
  timestamp?: string;
  page?: string | null;
  path?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  device?: string | null;
  country?: string | null;
  url?: string;
  user_agent?: string;
  metadata?: StructuralAnalyticsMetadata;
  data?: StructuralAnalyticsMetadata;
};
