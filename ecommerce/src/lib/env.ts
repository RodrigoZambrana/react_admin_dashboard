const ensureHttps = (value: string, context: "server" | "client") => {
  if (!value) {
    return value;
  }

  if (process.env.NODE_ENV === "production" && value.startsWith("http://")) {
    throw new Error(
      `[storefront] ${context} API URL must use HTTPS in production. Received "${value}". Update your environment configuration.`
    );
  }

  return value;
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

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
};

const DEFAULT_API_BASE = "http://localhost:4000/api/storefront";

const serverApiBaseRaw =
  process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STOREFRONT_API_URL ?? DEFAULT_API_BASE;
const clientApiBaseRaw =
  process.env.NEXT_PUBLIC_STOREFRONT_API_URL ?? serverApiBaseRaw ?? DEFAULT_API_BASE;

const googleAuthDebugPreference = parseBoolean(
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_DEBUG ?? process.env.GOOGLE_AUTH_DEBUG
);

export const env = {
  apiBaseUrl: normalize(serverApiBaseRaw, "server") || DEFAULT_API_BASE,
  publicApiBaseUrl: normalize(clientApiBaseRaw, "client") || DEFAULT_API_BASE,
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDevelopment: process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",
  googleAuthDebugEnabled: googleAuthDebugPreference ?? process.env.NODE_ENV !== "production"
};
