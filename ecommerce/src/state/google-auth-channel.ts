import type { AuthSession } from "@/types/storefront";

export const GOOGLE_AUTH_MESSAGE_TYPE = "storefront:google-auth" as const;
export const GOOGLE_AUTH_STORAGE_KEY = "storefront:google-auth-result" as const;
export const GOOGLE_AUTH_WINDOW_NAME_PREFIX = "storefront:google-auth:" as const;

export type GoogleAuthSuccessMessage = {
  type: typeof GOOGLE_AUTH_MESSAGE_TYPE;
  state: string;
  status: "success";
  session: AuthSession;
  returnPath?: string | null;
};

export type GoogleAuthErrorMessage = {
  type: typeof GOOGLE_AUTH_MESSAGE_TYPE;
  state: string;
  status: "error";
  errorCode?: string;
  message?: string;
  details?: string | null;
  returnPath?: string | null;
};

export type GoogleAuthMessage = GoogleAuthSuccessMessage | GoogleAuthErrorMessage;

export const isGoogleAuthMessage = (value: unknown): value is GoogleAuthMessage => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  if (payload.type !== GOOGLE_AUTH_MESSAGE_TYPE) {
    return false;
  }

  if (typeof payload.state !== "string") {
    return false;
  }

  if (payload.status === "success") {
    return typeof payload.session === "object" && payload.session !== null;
  }

  if (payload.status === "error") {
    return true;
  }

  return false;
};

export const parseGoogleAuthStorageValue = (raw: string | null): GoogleAuthMessage | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isGoogleAuthMessage(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[session] Failed to parse Google auth storage payload", error);
    return null;
  }
};

export const decodeGoogleAuthWindowName = (value: string | null | undefined): GoogleAuthMessage | null => {
  if (!value || !value.startsWith(GOOGLE_AUTH_WINDOW_NAME_PREFIX)) {
    return null;
  }

  const encoded = value.slice(GOOGLE_AUTH_WINDOW_NAME_PREFIX.length);
  if (!encoded) {
    return null;
  }

  try {
    const json = decodeURIComponent(encoded);
    const parsed = JSON.parse(json) as unknown;
    return isGoogleAuthMessage(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[session] Failed to decode Google auth payload from window.name", error);
    return null;
  }
};
