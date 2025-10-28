import { env } from "./env";

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: HeadersInit;
  timeoutMs?: number;
  cache?: RequestCache;
}

export interface ApiErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorPayload;
  requestId?: string | null;

  constructor(status: number, message: string, payload?: ApiErrorPayload, requestId?: string | null) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.requestId = requestId ?? undefined;
  }
}

export async function apiFetch<TResponse>(path: string, init: ApiRequestOptions = {}): Promise<TResponse> {
  const baseUrl = env.apiBaseUrl;
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(trimmedPath, base);

  if (init.params) {
    Object.entries(init.params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      url.searchParams.append(key, String(value));
    });
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timeoutMs = init.timeoutMs ?? 15_000;
  let timeoutId: NodeJS.Timeout | undefined;

  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const providedHeaders = new Headers(init.headers ?? undefined);
    const baseHeaders = new Headers({ Accept: "application/json" });
    const shouldSetJsonContentType =
      typeof init.body === "string" && !providedHeaders.has("Content-Type");

    if (shouldSetJsonContentType) {
      baseHeaders.set("Content-Type", "application/json");
    }

    providedHeaders.forEach((value, key) => {
      baseHeaders.set(key, value);
    });

    const response = await fetch(url, {
      ...init,
      headers: baseHeaders,
      signal: controller?.signal ?? init.signal,
      cache: init.cache ?? "no-store"
    });

    const requestId = response.headers.get("x-request-id");
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");

    if (!response.ok) {
      const payload = isJson
        ? ((await response.json().catch(() => undefined)) as ApiErrorPayload | undefined)
        : undefined;
      const message = payload?.message ?? `Request to ${url} failed with status ${response.status}`;
      throw new ApiError(response.status, message, payload, requestId);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    if (!isJson) {
      throw new ApiError(response.status, `Unexpected response type for ${url}`, undefined, requestId);
    }

    return (await response.json()) as TResponse;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
