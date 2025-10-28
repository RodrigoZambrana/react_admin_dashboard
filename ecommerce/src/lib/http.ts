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

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        credentials: init.credentials ?? "include",
        headers: baseHeaders,
        signal: controller?.signal ?? init.signal,
        cache: init.cache ?? "no-store"
      });
    } catch (rawError) {
      if (rawError instanceof DOMException && rawError.name === "AbortError") {
        throw new ApiError(
          408,
          "La solicitud tardó demasiado y se canceló. Revisa tu conexión e inténtalo nuevamente."
        );
      }
      if (rawError instanceof TypeError) {
        throw new ApiError(
          0,
          "No pudimos conectar con el servidor. Verifica tu conexión e intenta de nuevo."
        );
      }
      if (rawError instanceof Error) {
        throw new ApiError(0, rawError.message || "Ocurrió un error de red inesperado.");
      }
      throw rawError;
    }

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
