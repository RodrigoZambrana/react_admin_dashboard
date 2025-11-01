import { env } from "./env";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAYS_MS = [500, 1_500];
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_FAILURE_WINDOW_MS = 60_000;
const CIRCUIT_OPEN_INTERVAL_MS = 45_000;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

type CircuitState = "closed" | "open" | "half_open";

interface CircuitEntry {
  state: CircuitState;
  failureCount: number;
  firstFailureAt: number;
  nextAttemptAt: number;
  openedAt?: number;
}

export interface StandardErrorBody {
  code: string;
  httpStatus: number;
  message: string;
  details?: unknown;
  correlationId?: string;
  timestamp?: string;
}

export interface StandardErrorEnvelope {
  ok: false;
  error: StandardErrorBody;
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  circuitId?: string;
  correlationId?: string;
  onRetry?: (attempt: number, error: ApiError) => void;
}

interface PerformRequestOptions {
  correlationId: string;
  timeoutMs: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const generateCorrelationId = () => {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const mapStatusToCode = (status: number): string => {
  switch (status) {
    case 401:
      return "AUTH.UNAUTHORIZED";
    case 403:
      return "AUTH.FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 408:
      return "BACKEND.TIMEOUT";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION.FAILED";
    case 429:
      return "RATE.LIMITED";
    case 503:
      return "DB.CONNECTION";
    case 504:
      return "BACKEND.TIMEOUT";
    default:
      return "UNKNOWN";
  }
};

const isRetryable = (status: number, code?: string, isNetworkError = false, isTimeout = false): boolean => {
  if (isNetworkError || isTimeout) {
    return true;
  }
  if (status === 0) {
    return true;
  }
  if (RETRYABLE_STATUS.has(status)) {
    return true;
  }
  if (!code) {
    return false;
  }
  return ["RATE.LIMITED", "BACKEND.TIMEOUT", "DB.TIMEOUT", "DB.CONNECTION", "DB.PANIC"].includes(code);
};

const affectsCircuit = (status: number, code?: string, isNetworkError = false, isTimeout = false, isCancellation = false): boolean => {
  if (isCancellation) {
    return false;
  }
  if (isNetworkError || isTimeout) {
    return true;
  }
  if (status === 0) {
    return true;
  }
  if (RETRYABLE_STATUS.has(status)) {
    return true;
  }
  if (!code) {
    return status >= 500;
  }
  return ["RATE.LIMITED", "BACKEND.TIMEOUT", "DB.TIMEOUT", "DB.CONNECTION", "DB.PANIC", "UNKNOWN"].includes(code) || status >= 500;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  correlationId?: string;
  timestamp?: string;
  retryAfter?: number;
  retryable: boolean;
  affectsCircuit: boolean;
  isNetworkError: boolean;
  isTimeout: boolean;
  isCancellation: boolean;

  constructor(params: {
    status: number;
    code?: string;
    message: string;
    details?: unknown;
    correlationId?: string;
    timestamp?: string;
    retryAfter?: number;
    retryable?: boolean;
    affectsCircuit?: boolean;
    isNetworkError?: boolean;
    isTimeout?: boolean;
    isCancellation?: boolean;
  }) {
    super(params.message);
    this.status = params.status;
    this.code = params.code ?? mapStatusToCode(params.status);
    this.details = params.details;
    this.correlationId = params.correlationId;
    this.timestamp = params.timestamp;
    this.retryAfter = params.retryAfter;
    this.retryable =
      params.retryable ??
      isRetryable(params.status, params.code, params.isNetworkError, params.isTimeout);
    this.affectsCircuit =
      params.affectsCircuit ??
      affectsCircuit(
        params.status,
        params.code,
        params.isNetworkError,
        params.isTimeout,
        params.isCancellation,
      );
    this.isNetworkError = params.isNetworkError ?? false;
    this.isTimeout = params.isTimeout ?? false;
    this.isCancellation = params.isCancellation ?? false;
  }

  static fromEnvelope(envelope: StandardErrorEnvelope, fallbackStatus: number, correlationId?: string, retryAfter?: number) {
    const { error } = envelope;
    return new ApiError({
      status: error.httpStatus ?? fallbackStatus,
      code: error.code ?? mapStatusToCode(fallbackStatus),
      message: error.message ?? "errors.unknown",
      details: error.details,
      correlationId: error.correlationId ?? correlationId,
      timestamp: error.timestamp,
      retryAfter,
      retryable: isRetryable(error.httpStatus ?? fallbackStatus, error.code),
      affectsCircuit: affectsCircuit(error.httpStatus ?? fallbackStatus, error.code),
    });
  }
}

export class CircuitOpenError extends ApiError {
  readonly nextAttemptAt: number;
  readonly circuitId: string;

  constructor(params: { circuitId: string; correlationId: string; nextAttemptAt: number }) {
    super({
      status: 503,
      code: "CIRCUIT.OPEN",
      message: "errors.circuitOpen",
      correlationId: params.correlationId,
      details: { nextAttemptAt: params.nextAttemptAt },
      retryable: true,
      affectsCircuit: false,
    });
    this.nextAttemptAt = params.nextAttemptAt;
    this.circuitId = params.circuitId;
  }
}

class CircuitBreaker {
  private circuits = new Map<string, CircuitEntry>();

  async execute<T>(key: string, correlationId: string, fn: () => Promise<T>): Promise<T> {
    const entry = this.circuits.get(key) ?? this.createEntry(key);
    const now = Date.now();

    if (entry.state === "open") {
      if (now < entry.nextAttemptAt) {
        throw new CircuitOpenError({
          circuitId: key,
          correlationId,
          nextAttemptAt: entry.nextAttemptAt,
        });
      }
      entry.state = "half_open";
    }

    try {
      const result = await fn();
      this.onSuccess(key);
      return result;
    } catch (error) {
      this.onFailure(key, error, now);
      throw error;
    }
  }

  private createEntry(key: string): CircuitEntry {
    const entry: CircuitEntry = {
      state: "closed",
      failureCount: 0,
      firstFailureAt: 0,
      nextAttemptAt: 0,
    };
    this.circuits.set(key, entry);
    return entry;
  }

  private onSuccess(key: string) {
    const entry = this.circuits.get(key);
    if (!entry) {
      return;
    }
    entry.state = "closed";
    entry.failureCount = 0;
    entry.firstFailureAt = 0;
    entry.nextAttemptAt = 0;
  }

  private onFailure(key: string, error: unknown, now: number) {
    const entry = this.circuits.get(key) ?? this.createEntry(key);
    if (!(error instanceof ApiError)) {
      return;
    }

    if (!error.affectsCircuit) {
      if (entry.state !== "closed") {
        entry.state = "closed";
      }
      entry.failureCount = 0;
      entry.firstFailureAt = 0;
      entry.nextAttemptAt = 0;
      return;
    }

    if (entry.state === "half_open") {
      entry.state = "open";
      entry.failureCount = 0;
      entry.firstFailureAt = now;
      entry.nextAttemptAt = now + CIRCUIT_OPEN_INTERVAL_MS;
      entry.openedAt = now;
      return;
    }

    if (!entry.firstFailureAt || now - entry.firstFailureAt > CIRCUIT_FAILURE_WINDOW_MS) {
      entry.firstFailureAt = now;
      entry.failureCount = 1;
    } else {
      entry.failureCount += 1;
    }

    if (entry.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
      entry.state = "open";
      entry.openedAt = now;
      entry.nextAttemptAt = now + CIRCUIT_OPEN_INTERVAL_MS;
      entry.failureCount = 0;
      entry.firstFailureAt = 0;
    }
  }
}

class HttpClient {
  private readonly baseUrl: string;
  private readonly breaker = new CircuitBreaker();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
    const url = new URL(trimmedPath, this.baseUrl);

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        url.searchParams.append(key, String(value));
      });
    }

    const correlationId = options.correlationId ?? generateCorrelationId();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

    const {
      params,
      timeoutMs: _timeout,
      retryDelaysMs: _retryDelays,
      circuitId,
      correlationId: _corr,
      onRetry,
      ...rest
    } = options;

    const headers = new Headers(rest.headers ?? undefined);
    headers.set("Accept", "application/json");
    if (
      rest.body &&
      typeof rest.body === "string" &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("X-Correlation-Id", correlationId);

    const requestInit: RequestInit = {
      ...rest,
      headers,
      credentials: rest.credentials ?? "include",
      cache: rest.cache ?? "no-store",
    };

    const key = circuitId ?? this.buildCircuitKey((requestInit.method ?? "GET").toUpperCase(), url.pathname);

    return this.breaker.execute(key, correlationId, async () => {
      return this.requestWithRetries<T>(url, requestInit, {
        correlationId,
        timeoutMs,
        retryDelays,
        onRetry,
        method: (requestInit.method ?? "GET").toUpperCase(),
      });
    });
  }

  private buildCircuitKey(method: string, pathname: string) {
    return `${method.toUpperCase()}::${pathname}`;
  }

  private async requestWithRetries<T>(
    url: URL,
    init: RequestInit,
    meta: {
      correlationId: string;
      timeoutMs: number;
      retryDelays: number[];
      onRetry?: (attempt: number, error: ApiError) => void;
      method: string;
    },
  ): Promise<T> {
    const maxAttempts = meta.retryDelays.length + 1;
    let attempt = 0;
    let lastError: ApiError | undefined;

    while (attempt < maxAttempts) {
      try {
        return await this.performRequest<T>(url, init, {
          correlationId: meta.correlationId,
          timeoutMs: meta.timeoutMs,
        });
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error;
        }

        lastError = error;
        const remaining = maxAttempts - attempt - 1;
        if (!this.shouldRetry(error, remaining, meta.method)) {
          throw error;
        }
        const delay = meta.retryDelays[Math.min(attempt, meta.retryDelays.length - 1)];
        if (meta.onRetry) {
          meta.onRetry(attempt + 1, error);
        }
        await sleep(delay);
        attempt += 1;
      }
    }

    throw lastError ?? new ApiError({ status: 500, message: "errors.unknown" });
  }

  private shouldRetry(error: ApiError, remainingAttempts: number, method: string) {
    if (remainingAttempts <= 0) {
      return false;
    }
    if (error.isCancellation) {
      return false;
    }
    const upperMethod = method.toUpperCase();
    const isIdempotent = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"].includes(upperMethod);
    if (!isIdempotent && !(upperMethod === "POST" && error.status === 429)) {
      return false;
    }
    return error.retryable;
  }

  private async performRequest<T>(
    url: URL,
    init: RequestInit,
    options: PerformRequestOptions,
  ): Promise<T> {
    const { correlationId, timeoutMs } = options;
    const { signal: externalSignal, ...rest } = init;
    const controller = new AbortController();
    let timeoutTriggered = false;

    const timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, timeoutMs);

    let abortListener: (() => void) | undefined;
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort((externalSignal as AbortSignal & { reason?: unknown }).reason);
      } else {
        abortListener = () => controller.abort((externalSignal as AbortSignal & { reason?: unknown }).reason);
        externalSignal.addEventListener("abort", abortListener);
      }
    }

    try {
      const response = await fetch(url, {
        ...rest,
        signal: controller.signal,
      });

      const responseCorrelationId =
        response.headers.get("x-correlation-id") ?? response.headers.get("x-request-id") ?? correlationId;
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");

      if (!response.ok) {
        if (isJson) {
          const payload = (await response.json().catch(() => undefined)) as StandardErrorEnvelope | undefined;
          if (payload && payload.ok === false && payload.error) {
            throw ApiError.fromEnvelope(payload, response.status, responseCorrelationId, retryAfter);
          }
        }

        throw new ApiError({
          status: response.status,
          code: mapStatusToCode(response.status),
          message: "errors.requestFailed",
          correlationId: responseCorrelationId,
          retryAfter,
          retryable: isRetryable(response.status),
          affectsCircuit: affectsCircuit(response.status),
        });
      }

      if (response.status === 204) {
        return undefined as T;
      }

      if (!isJson) {
        throw new ApiError({
          status: response.status,
          code: "INVALID.RESPONSE",
          message: "errors.invalidResponse",
          correlationId: responseCorrelationId,
          retryable: false,
          affectsCircuit: false,
        });
      }

      return (await response.json()) as T;
    } catch (rawError) {
      if (rawError instanceof ApiError) {
        throw rawError;
      }

      if (rawError instanceof DOMException && rawError.name === "AbortError") {
        if (timeoutTriggered) {
          throw new ApiError({
            status: 408,
            code: "BACKEND.TIMEOUT",
            message: "errors.timeout",
            correlationId,
            isTimeout: true,
            retryable: true,
            affectsCircuit: true,
          });
        }
        throw new ApiError({
          status: 499,
          code: "CLIENT.CANCELLED",
          message: "errors.requestCancelled",
          correlationId,
          retryable: false,
          affectsCircuit: false,
          isCancellation: true,
        });
      }

      if (rawError instanceof TypeError) {
        throw new ApiError({
          status: 0,
          code: "NETWORK.OFFLINE",
          message: "errors.networkOffline",
          correlationId,
          retryable: true,
          affectsCircuit: true,
          isNetworkError: true,
        });
      }

      if (rawError instanceof Error) {
        throw new ApiError({
          status: 500,
          code: "UNKNOWN",
          message: "errors.unknown",
          details: { reason: rawError.message },
          correlationId,
          retryable: false,
          affectsCircuit: true,
        });
      }

      throw rawError;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal && abortListener) {
        externalSignal.removeEventListener("abort", abortListener);
      }
    }
  }
}

const httpClient = new HttpClient(env.apiBaseUrl);

export const apiFetch = <TResponse>(path: string, init: ApiRequestOptions = {}) =>
  httpClient.request<TResponse>(path, init);

export const getHttpClient = () => httpClient;

export const createCorrelationId = generateCorrelationId;

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
