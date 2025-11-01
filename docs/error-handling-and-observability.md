# Unified Error Handling & Observability

This document consolidates the backend ↔ frontend contract, UI behaviour patterns, and validation/QA scenarios introduced to harden the ecommerce storefront (Next.js) and the administrative frontend (React/Vite) against flaky APIs and transient infrastructure failures.

## 1. Standard error envelope (backend → frontend)

Every non-2xx backend response now conforms to a single JSON envelope:

```json
{
  "ok": false,
  "error": {
    "code": "BACKEND.TIMEOUT",
    "httpStatus": 504,
    "message": "errors.timeout",
    "details": {
      "retryAfter": 30,
      "model": "Order",
      "action": "findMany"
    },
    "correlationId": "3d48a4e0-61f0-4652-8cba-4d36414102d1",
    "timestamp": "2025-03-18T12:02:48.134Z"
  }
}
```

Backends map Prisma, authentication, throttling and transport errors to the following taxonomy:

| Code | HTTP | Description | Default i18n key |
| ---- | ---- | ----------- | ---------------- |
| `BACKEND.TIMEOUT` | 408 / 504 | API or upstream timeout | `errors.timeout` |
| `DB.CONNECTION` | 503 | Prisma client initialisation failed | `errors.dbConnection` |
| `DB.TIMEOUT` | 504 | Query exceeded configured timeout | `errors.dbTimeout` |
| `DB.PANIC` | 500 | Query engine panic | `errors.dbPanic` |
| `DB.CONFLICT` | 409 | Unique constraint violated (`P2002`) | `errors.conflict` |
| `AUTH.UNAUTHORIZED` | 401 | Session expired or invalid token | `errors.unauthorized` |
| `AUTH.FORBIDDEN` | 403 | Insufficient permissions | `errors.forbidden` |
| `VALIDATION.FAILED` | 400 / 422 | Request failed server-side validation | `errors.validation` |
| `RATE.LIMITED` | 429 | Throttler trip, `Retry-After` header populated | `errors.rateLimited` |
| `NOT_FOUND` | 404 | Resource missing (`P2025`, explicit 404) | `errors.notFound` |
| `CONFLICT` | 409 | Business conflict (idempotency, duplicates) | `errors.conflict` |
| `UNKNOWN` | 500 | Safety net for unexpected failures | `errors.unknown` |

The filter also attaches `Cache-Control: no-store`, `Pragma: no-cache`, `X-Correlation-Id` and `Retry-After` (when relevant), while logging correlation-aware structured entries and forwarding enriched context to the `ObservabilityService` (Sentry, Prometheus stubs).

## 2. Backend runtime protections

- **CorrelationId middleware** injects/propagates `X-Correlation-Id` on every request and scopes Fastify’s pino logger.
- **GlobalExceptionFilter** normalises Nest/Prisma/Throttler exceptions into the unified envelope, sanitising messages to avoid leaking SQL/PII, and records structured metrics (`ObservabilityService.recordHttpError`).
- **Prisma timeout guard** wraps every query with a controllable timeout (`PRISMA_QUERY_TIMEOUT_MS`, default 15s) and surfaces `DB.TIMEOUT` errors with lightweight logging.
- **Timeout interceptor** fails handler pipelines after 15s with a translated timeout message, preventing hung HTTP requests.
- **Health endpoints** now expose `GET /healthz`, `GET /readyz` (DB probe), `GET /health` for legacy checks.
- **ObservabilityService** (opt-in) initialises Sentry when `SENTRY_DSN` is available and maintains in-memory counters that can be scraped for quick Prometheus ingress.

## 3. Frontend HTTP client stack

Both apps converge on the same resilience primitives:

- **Circuit breaker** (threshold = 5 failures / 60s window, cool-off 45s) per method+resource.
- **Time boxed fetches** (15s default via `AbortController` / Axios `signal` + timeout).
- **Retry with exponential backoff** (`500ms`, `1500ms`) for idempotent requests hitting `408/425/429/5xx` or network errors. POSTs only retry on `429`.
- **Correlation propagation** – clients generate a UUID per request (exposed through the `useApiRequest` hook) and set `X-Correlation-Id` for traceability.
- **Envelope parsing** – both clients unwrap the backend payload, surface `ApiError` instances with `status`, `code`, `details`, `retryAfter`, `correlationId`, and distinguish cancellation vs timeout vs offline states.
- **Shared UI primitives**:
  - `ErrorState` component: actionable messaging, correlation ID, retry CTA.
  - `LoadingWithTimeout`: prevents infinite spinners by surfacing a slow-load hint after 7s.
  - `NetworkStatusBanner`: fixed offline/reconnect notifications.
  - Hooks (`useApiRequest`, `useNetworkStatus`, `useCorrelationId`) orchestrate stale-while-revalidate fallbacks and cancellation on unmount/route changes.
- **Observability stubs** (`lib/observability.ts`) forward errors to a browser Sentry SDK when available, otherwise logging during development.

Existing services now consume the resilient HTTP clients:

- Storefront `apiFetch` composes the new fetch wrapper.
- Admin `ApiService` and RTK query base leverage the Axios-aware `apiClient` with retries/circuit breaker baked in.

## 4. UX guidelines (Next.js storefront & admin)

- Loading states switch to slow-load messaging after 7s; no spinner remains indefinitely.
- Toasts include retry affordances for transient failures; blocking views carry `ErrorState` + correlation ID.
- Rate limits surface countdowns using `Retry-After` (hook available via `ApiError.retryAfter`).
- Offline banner automatically retries once connectivity resumes.
- Authentication failures trigger existing sign-out flows and a session-expired modal (admin) or login redirect (storefront).
- Form submissions should attach `Idempotency-Key` headers (scaffolding ready in HTTP clients).

## 5. Acceptance & QA checklist

| Scenario | Expected behaviour |
| -------- | ------------------ |
| API offline (`ECONNREFUSED`) | Show offline banner + ErrorState; retries (max 2) then circuit opens for 45s while stale data remains visible. |
| Prisma unique violation | `errors.conflict` surfaced inline; no sensitive meta leaked. |
| Request timeout (`>15s`) | Abort with `errors.timeout`, retry CTA and correlation ID. |
| 401/403 | Auto sign-out (admin) or modal prompt (storefront); envelope `AUTH.UNAUTHORIZED/ AUTH.FORBIDDEN`. |
| 422 validation | Field-level errors preserved (`details.errors`) and mapped via i18n. |
| 429 throttle | Retry banner counts down using `Retry-After`; circuit records failure but remains closed until threshold reached. |
| Route change mid-request | Abort occurs, no error toast (marked as cancellation). |
| Offline toggle (devtools) | Banner “Sin conexión. Reintentaremos automáticamente.” appears; auto-refresh once connection returns. |

## 6. Metrics & Sentry

- **Sentry (optional)**: set `SENTRY_DSN` (backend) or include the browser SDK on the client to capture correlation-rich events. Missing SDKs are tolerated – modules degrade to structured logs.
- **Prometheus readiness**: `ObservabilityService.snapshotErrorMetrics()` exposes per-code counters that can be wired into an HTTP exporter (e.g. Fastify route returning Prometheus text/plain) without blocking request handlers.
- **Tracing**: correlation IDs (also propagated to the storefront/admin via headers and `ApiError`) allow cross-system log aggregation and incident drill-down.

## 7. Roll-out plan

1. **Phase 1** – enable new HTTP clients + envelope + base UI (already implemented). Begin migrating views to `useApiRequest` gradually.
2. **Phase 2** – wrap major screens with `ErrorState` / `LoadingWithTimeout`, add toast helpers, wire session expiry modal.
3. **Phase 3** – expose Prometheus endpoint, add Sentry SDKs to deployments, hook dashboards and alerts (p95 latency, circuit-open counts, error spikes).
4. **Phase 4** – finalise i18n coverage, audit accessibility (focus management, ARIA live regions), expand automated QA to cover offline/timeout cases.

---

For implementation details see:

- Backend middleware, filters, interceptors: `backend/src/common/**`
- Storefront HTTP client & hooks: `ecommerce/src/lib/http.ts`, `ecommerce/src/hooks/**`
- Admin HTTP client & hooks: `frontend/src/lib/httpClient.ts`, `frontend/src/hooks/**`
- Shared UI states: `ecommerce/src/components/status/**`, `frontend/src/components/shared/status/**`
