import { DEFAULT_CLIENT_SLUG } from "@/constants/tenancy";

const ensureHttps = (value: string, context: "server" | "client") => {
  if (!value) {
    return value;
  }

  if (process.env.NODE_ENV === "production" && value.startsWith("http://")) {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
      const isInternalDockerHost = !hostname.includes(".") || hostname.endsWith(".local");
      if (!isLocalhost && !isInternalDockerHost) {
        throw new Error(
          `[storefront] ${context} API URL must use HTTPS in production. Received "${value}". Update your environment configuration.`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        `[storefront] ${context} API URL must use HTTPS in production. Received "${value}". Update your environment configuration.`
      );
    }
  }

  return value;
};

const removeTrailingSlash = (value: string): string => {
  if (!value) {
    return value;
  }
  return value.endsWith("/") && value.length > 1 ? value.slice(0, -1) : value;
};

const normalize = (value: string, context: "server" | "client"): string => {
  if (!value) {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const sanitized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  return ensureHttps(sanitized, context);
};

const ensureStorefrontPath = (value: string): string => {
  if (!value) {
    return value;
  }
  try {
    const url = new URL(value);
    const path = removeTrailingSlash(url.pathname || "");
    if (!path || path === "" || path === "/") {
      url.pathname = "/api/storefront";
    } else if (path === "/storefront") {
      url.pathname = "/api/storefront";
    } else if (path.endsWith("/storefront")) {
      url.pathname = path;
    } else if (path.endsWith("/api")) {
      url.pathname = `${path}/storefront`;
    } else if (!path.includes("/storefront")) {
      url.pathname = `${path}/storefront`;
    }
    return removeTrailingSlash(url.toString());
  } catch {
    return value;
  }
};

const DEFAULT_API_BASE = "http://localhost:4000/api/storefront";
const DEFAULT_AUTH_API_BASE = "http://localhost:4000/api";
const DEFAULT_ANALYTICS_API_BASE = "http://localhost:4000/api/analytics";
const DEFAULT_AI_PLATFORM_BASE = "http://localhost:4110";
const DEFAULT_SITE_URL = "http://localhost:3000";
const DEFAULT_MEDIA_BASE_URL = "http://localhost:3000/media";
const DEFAULT_MEDIA_PROVIDER = "local";

const normalizeClientSlug = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase();
};

const resolvedClientSlug =
  normalizeClientSlug(process.env.CLIENT_SLUG) ??
  normalizeClientSlug(process.env.NEXT_PUBLIC_CLIENT_SLUG) ??
  DEFAULT_CLIENT_SLUG;

const serverApiBaseRaw =
  process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STOREFRONT_API_URL ?? DEFAULT_API_BASE;
const clientApiBaseRaw =
  process.env.NEXT_PUBLIC_STOREFRONT_API_URL ?? serverApiBaseRaw ?? DEFAULT_API_BASE;
const serverAuthApiBaseRaw =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_AUTH_API_URL ?? DEFAULT_AUTH_API_BASE;
const clientAuthApiBaseRaw =
  process.env.NEXT_PUBLIC_AUTH_API_URL ?? serverAuthApiBaseRaw ?? DEFAULT_AUTH_API_BASE;
const serverAnalyticsBaseRaw =
  process.env.ANALYTICS_API_URL ??
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL ??
  DEFAULT_ANALYTICS_API_BASE;
const clientAnalyticsBaseRaw =
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL ?? serverAnalyticsBaseRaw ?? DEFAULT_ANALYTICS_API_BASE;
const aiPlatformBaseRaw =
  process.env.NEXT_PUBLIC_AI_PLATFORM_URL ??
  DEFAULT_AI_PLATFORM_BASE;
const clientSiteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
const clientMediaBaseUrlRaw = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? DEFAULT_MEDIA_BASE_URL;
const clientMediaProviderRaw = process.env.NEXT_PUBLIC_MEDIA_PROVIDER ?? DEFAULT_MEDIA_PROVIDER;

const normalizedApiBase =
  ensureStorefrontPath(normalize(serverApiBaseRaw, "server")) || DEFAULT_API_BASE;
const normalizedPublicApiBase =
  ensureStorefrontPath(normalize(clientApiBaseRaw, "client")) || DEFAULT_API_BASE;
const normalizedAuthApiBase =
  removeTrailingSlash(normalize(serverAuthApiBaseRaw, "server")) || DEFAULT_AUTH_API_BASE;
const normalizedPublicAuthApiBase =
  removeTrailingSlash(normalize(clientAuthApiBaseRaw, "client")) || DEFAULT_AUTH_API_BASE;
const normalizedAnalyticsApiBase =
  removeTrailingSlash(normalize(serverAnalyticsBaseRaw, "server")) || DEFAULT_ANALYTICS_API_BASE;
const normalizedPublicAnalyticsApiBase =
  removeTrailingSlash(normalize(clientAnalyticsBaseRaw, "client")) || DEFAULT_ANALYTICS_API_BASE;
const normalizedAiPlatformBase =
  removeTrailingSlash(normalize(aiPlatformBaseRaw, "client")) || DEFAULT_AI_PLATFORM_BASE;
const normalizedSiteUrl = normalize(clientSiteUrlRaw, "client") || DEFAULT_SITE_URL;
const normalizedMediaBaseUrl = normalize(clientMediaBaseUrlRaw, "client") || DEFAULT_MEDIA_BASE_URL;
const normalizedMediaProvider = clientMediaProviderRaw.trim().toLowerCase() === "cloudinary" ? "cloudinary" : "local";

const safeOrigin = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const env = {
  apiBaseUrl: normalizedApiBase,
  publicApiBaseUrl: normalizedPublicApiBase,
  authApiBaseUrl: normalizedAuthApiBase,
  publicAuthApiBaseUrl: normalizedPublicAuthApiBase,
  analyticsApiBaseUrl: normalizedAnalyticsApiBase,
  publicAnalyticsApiBaseUrl: normalizedPublicAnalyticsApiBase,
  publicAiPlatformUrl: normalizedAiPlatformBase,
  publicSiteUrl: normalizedSiteUrl,
  publicMediaBaseUrl: normalizedMediaBaseUrl,
  publicMediaProvider: normalizedMediaProvider,
  publicSiteOrigin: safeOrigin(normalizedSiteUrl) ?? safeOrigin(DEFAULT_SITE_URL),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDevelopment: process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",
  clientSlug: resolvedClientSlug
};
