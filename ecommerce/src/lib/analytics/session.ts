const SESSION_KEY = "analytics_session_state";
const TRACKING_CONSENT_KEY = "analytics_tracking_consent";
const META_FBP_COOKIE = "_fbp";
const META_FBC_COOKIE = "_fbc";

export type AnalyticsAttribution = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
  landing_page?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type AnalyticsSessionState = AnalyticsAttribution & {
  session_id: string;
  first_seen_at: string;
  last_seen_at: string;
  fbp?: string | null;
  fbc?: string | null;
};

export type AnalyticsContext = {
  session_id: string;
  page: string;
  path: string;
  device: string | null;
  country: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fbp: string | null;
  fbc: string | null;
};

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `analytics-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const safeParseJson = <T,>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const readCookie = (name: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const escaped = name.replace(/([.*+?^${}()|[\]\\])/g, "\\$1");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 90) => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    "path=/",
    `max-age=${maxAgeSeconds}`,
    "SameSite=Lax",
  ].join("; ");
};

const detectDevice = () => {
  if (typeof navigator === "undefined") {
    return null;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  if (/tablet|ipad/.test(userAgent)) {
    return "tablet";
  }
  if (/mobi|android|iphone|ipod/.test(userAgent)) {
    return "mobile";
  }
  return "desktop";
};

const getLocationSearchParams = () => {
  if (typeof window === "undefined" || !window.location) {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
};

const createMetaBrowserId = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).slice(2);
  return `fb.1.${timestamp}.${random}`;
};

const createMetaClickId = (fbclid: string) => `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;

const resolveMetaIdentifiers = () => {
  const params = getLocationSearchParams();
  const fbclid = params.get("fbclid")?.trim() || null;
  const fbp = readCookie(META_FBP_COOKIE) ?? createMetaBrowserId();
  const fbc = readCookie(META_FBC_COOKIE) ?? (fbclid ? createMetaClickId(fbclid) : null);

  writeCookie(META_FBP_COOKIE, fbp);
  if (fbc) {
    writeCookie(META_FBC_COOKIE, fbc);
  }

  return {
    fbp,
    fbc,
  };
};

const readConsentFlag = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return true;
  }

  const stored = window.localStorage.getItem(TRACKING_CONSENT_KEY);
  if (stored === null) {
    return true;
  }

  return ["1", "true", "yes", "granted"].includes(stored.toLowerCase());
};

const resolveAttribution = (): AnalyticsAttribution => {
  const params = getLocationSearchParams();
  const utm_source = params.get("utm_source")?.trim() || null;
  const utm_medium = params.get("utm_medium")?.trim() || null;
  const utm_campaign = params.get("utm_campaign")?.trim() || null;
  const referrer =
    typeof document !== "undefined" && document.referrer?.trim().length > 0
      ? document.referrer.trim()
      : null;

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    referrer,
    landing_page:
      typeof window !== "undefined" && window.location ? window.location.pathname : null,
    ...resolveMetaIdentifiers(),
  };
};

const loadSessionState = (): AnalyticsSessionState | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return safeParseJson<AnalyticsSessionState>(window.localStorage.getItem(SESSION_KEY));
};

const saveSessionState = (state: AnalyticsSessionState) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
};

export const getAnalyticsSessionState = () => {
  const now = new Date().toISOString();
  const existing = loadSessionState();
  const attribution = resolveAttribution();

  if (!existing) {
    const created: AnalyticsSessionState = {
      session_id: createSessionId(),
      first_seen_at: now,
      last_seen_at: now,
      ...attribution,
    };
    saveSessionState(created);
    return created;
  }

  const next: AnalyticsSessionState = {
    ...existing,
    last_seen_at: now,
    utm_source: existing.utm_source ?? attribution.utm_source,
    utm_medium: existing.utm_medium ?? attribution.utm_medium,
    utm_campaign: existing.utm_campaign ?? attribution.utm_campaign,
    referrer: existing.referrer ?? attribution.referrer,
    landing_page: existing.landing_page ?? attribution.landing_page,
    fbp: existing.fbp ?? attribution.fbp,
    fbc: existing.fbc ?? attribution.fbc,
  };
  saveSessionState(next);
  return next;
};

export const getAnalyticsContext = (): AnalyticsContext => {
  const session = getAnalyticsSessionState();

  return {
    session_id: session.session_id,
    page: typeof window !== "undefined" && window.location ? `${window.location.pathname}${window.location.search}` : "",
    path: typeof window !== "undefined" && window.location ? window.location.pathname : "",
    device: detectDevice(),
    country: null,
    referrer: session.referrer ?? null,
    utm_source: session.utm_source ?? null,
    utm_medium: session.utm_medium ?? null,
    utm_campaign: session.utm_campaign ?? null,
    fbp: session.fbp ?? null,
    fbc: session.fbc ?? null,
  };
};

export const getSessionId = () => getAnalyticsSessionState().session_id;

export const hasAnalyticsConsent = () => readConsentFlag();

export const setAnalyticsConsent = (value: boolean) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(TRACKING_CONSENT_KEY, value ? "true" : "false");
};
