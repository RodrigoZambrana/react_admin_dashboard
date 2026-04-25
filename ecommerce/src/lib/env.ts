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
const DEFAULT_CHAT_AGENT_BASE = "http://localhost:4110";
const DEFAULT_SITE_URL = "http://localhost:3000";

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
const chatAgentBaseRaw =
  process.env.NEXT_PUBLIC_CHAT_AGENT_URL ??
  process.env.NEXT_PUBLIC_AI_PLATFORM_URL ??
  DEFAULT_CHAT_AGENT_BASE;
const clientSiteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;

const normalizedApiBase =
  ensureStorefrontPath(normalize(serverApiBaseRaw, "server")) || DEFAULT_API_BASE;
const normalizedPublicApiBase =
  ensureStorefrontPath(normalize(clientApiBaseRaw, "client")) || DEFAULT_API_BASE;
const normalizedChatAgentBase =
  removeTrailingSlash(normalize(chatAgentBaseRaw, "client")) || DEFAULT_CHAT_AGENT_BASE;
const normalizedSiteUrl = normalize(clientSiteUrlRaw, "client") || DEFAULT_SITE_URL;

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
  publicChatAgentUrl: normalizedChatAgentBase,
  publicSiteUrl: normalizedSiteUrl,
  publicSiteOrigin: safeOrigin(normalizedSiteUrl) ?? safeOrigin(DEFAULT_SITE_URL),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDevelopment: process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",
  clientSlug: resolvedClientSlug
};
