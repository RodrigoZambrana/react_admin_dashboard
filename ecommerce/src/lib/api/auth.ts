import { env } from "@/lib/env";
import { ApiError, StandardErrorEnvelope, createCorrelationId } from "@/lib/http";
import type {
  CloudinaryUploadSignatureResponse,
  CloudinaryUploadType,
  MediaProviderConfig,
} from "@/types/cloudinary-upload";
import type {
  PhoneAuthRecoverResponse,
  PhoneAuthRegisterResponse,
  PhoneAuthResetResponse,
  PhoneAuthVerifyResponse
} from "@/types/phone-auth";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

const buildUrl = (path: string) => {
  const resolvedBase =
    typeof window === "undefined" ? env.authApiBaseUrl : env.publicAuthApiBaseUrl;
  const base = resolvedBase.endsWith("/") ? resolvedBase : `${resolvedBase}/`;
  return new URL(path.replace(/^\//, ""), base).toString();
};

const parseError = async (response: Response, correlationId: string) => {
  const payload = (await response.json().catch(() => null)) as StandardErrorEnvelope | null;
  if (payload && payload.ok === false && payload.error) {
    return ApiError.fromEnvelope(payload, response.status, correlationId);
  }
  const message = response.statusText || "Request failed";
  return new ApiError({
    status: response.status,
    message,
    correlationId,
  });
};

async function authFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const correlationId = createCorrelationId();
  const response = await fetch(buildUrl(path), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Correlation-Id": correlationId,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    credentials: "include",
  });

  if (!response.ok) {
    throw await parseError(response, correlationId);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export const AuthApi = {
  getAuthConfig() {
    return authFetch<{ recaptcha?: unknown; google?: unknown; media: MediaProviderConfig }>("/auth/config");
  },

  getCloudinaryUploadSignature(payload: { productId: number; type: CloudinaryUploadType }) {
    return authFetch<CloudinaryUploadSignatureResponse>("/cloudinary/sign", {
      method: "POST",
      body: payload,
    });
  },

  register(payload: {
    phone: string;
    email?: string | null;
    password: string;
    name?: string | null;
    lastName?: string | null;
    locale?: string | null;
    recaptchaToken?: string;
  }) {
    return authFetch<PhoneAuthRegisterResponse>("/auth/register", {
      method: "POST",
      body: payload,
    });
  },

  sendOtp(payload: { phone: string; type?: "verification" | "recovery"; recaptchaToken?: string }) {
    return authFetch<{ ok: true }>("/auth/send-otp", {
      method: "POST",
      body: payload,
    });
  },

  verifyOtp(payload: { phone: string; code: string; recaptchaToken?: string }) {
    return authFetch<PhoneAuthVerifyResponse>("/auth/verify-otp", {
      method: "POST",
      body: payload,
    });
  },

  recover(payload: {
    method: "sms" | "email";
    phone?: string | null;
    email?: string | null;
    recaptchaToken?: string;
  }) {
    return authFetch<PhoneAuthRecoverResponse>("/auth/recover", {
      method: "POST",
      body: payload,
    });
  },

  resetPassword(payload:
    | { method: "sms"; phone: string; code: string; password: string; recaptchaToken?: string }
    | { method: "email"; token: string; password: string; recaptchaToken?: string }) {
    return authFetch<PhoneAuthResetResponse>("/auth/reset-password", {
      method: "POST",
      body: payload,
    });
  },
};
