# Endpoint Protection Audit Matrix

## Purpose

This document defines the operational audit matrix for minimum endpoint protections across the whole system.

It is not limited to email or inbox flows.

Minimum protections to verify per endpoint group:

- authentication
- authorization / roles / scopes
- rate limiting
- origin restrictions / CORS exposure
- internal-only vs public exposure boundary
- webhook signature / token validation where applicable

Status values:

- `covered`: implemented and intentionally documented
- `partial`: some protections exist, but the group still needs explicit audit or missing controls
- `pending`: protection baseline is not yet sufficient for acceptance

## Acceptance Rule

No new channel or externally reachable surface should be considered complete until its endpoint group reaches at least:

- `covered` for authentication/authorization boundary
- `covered` or explicitly justified for rate limiting
- `covered` or explicitly justified for origin/public exposure

---

## Backend

### Global backend runtime baseline

| Endpoint group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Nest global API baseline | Partial | Covered | Partial | `partial` | Global throttling exists in `backend/src/app.module.ts`; CORS allowlist exists in `backend/src/main.ts`; still requires endpoint-by-endpoint audit |

### Admin and backoffice domain controllers

| Endpoint group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `settings`, `users`, `customers`, `sales`, `orders`, `pricing`, `accounting`, `expenses`, `calendar`, `tasks`, `activities`, `notifications`, `production-orders`, `cms` | Partial | Covered | Partial | `partial` | Most are expected to be JWT-protected, but role coverage must be audited controller by controller |
| `inbox` | Partial | Covered | Partial | `partial` | JWT + roles now enforced at controller level; still needs audit of every route, especially sync and thread/history endpoints |
| `conversations` | Partial | Covered | Partial | `partial` | Sensitive takeover/assign/reply/admin-internal flows require explicit scope/role matrix audit |
| `ai` and `ai/knowledge` | Partial | Covered | Partial | `partial` | High-risk operational surface; needs strict review of admin-only actions and internal runtime contracts |
| `qa` | Partial | Covered | Partial | `partial` | QA endpoints should likely be restricted further or disabled outside controlled environments |
| `settings/email` | Partial | Covered | Partial | `partial` | Handles provider credentials and runtime settings; requires focused audit on access and redaction behavior |

### Customer/storefront-facing backend controllers

| Endpoint group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `storefront` public catalog/content endpoints | Partial | Covered | Partial | `partial` | Public exposure is expected; needs route classification between public and authenticated customer operations |
| `account`, `storefront/account/notifications` | Partial | Covered | Partial | `partial` | Customer auth exists in flows, but requires endpoint audit for customer-only access and abuse limits |
| `auth`, `email`, `catalog`, `health`, `project` root/public routes | Partial | Covered | Partial | `partial` | Public endpoints are acceptable when intentional, but must be cataloged explicitly and justified |

### Internal service integration endpoints

| Endpoint group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Internal AI/channel reply/status contracts under backend | Partial | Covered | Partial | `partial` | `x-ai-internal-token` exists in some flows, but trust boundaries and replay/rate policies still need audit |

---

## Frontend / Admin

### Admin application surfaces

| Surface group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Admin SPA routes and views | Partial | N/A client-side | Partial | `partial` | UI route gating helps UX, but real authority must remain backend-side; route inventory still needs mapping to protected backend contracts |
| Admin settings for email / AI / conversations | Partial | N/A client-side | Partial | `partial` | Sensitive because they surface operational controls and secrets indirectly; ensure no unsafe client exposure |
| Admin messaging/inbox/conversations views | Partial | N/A client-side | Partial | `partial` | Must consume only protected backend contracts and avoid leaking data through open client-side fetch paths |

Operational note:

- client-side route guards are not considered sufficient protection on their own
- acceptance depends on backend/API enforcement

---

## Storefront

### Next.js route handlers

| Endpoint group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `/api/health` | Public by design | Pending review | Public by design | `partial` | Acceptable as public health endpoint, but should be explicitly documented as such |
| `/api/internal/snapshots` | Covered by token | Pending review | Partial | `partial` | Token gate exists; still needs rate-limit and origin review |
| `/api/public/snapshots` | Public by design | Pending review | Public by design | `partial` | Must remain explicitly intentional and environment-gated |

### Storefront application behavior

| Surface group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Public storefront pages and backend API consumption | Partial | Covered via backend baseline | Partial | `partial` | Public browsing is expected, but backend routes behind the storefront still need audit by capability |
| Logged-in customer account/chat flows | Partial | Covered via backend baseline | Partial | `partial` | Important before extending messaging primitives into customer chat surfaces |

---

## AI Agent Service

### Current HTTP surface

| Endpoint group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `/health` | Public by design | Pending review | Pending review | `partial` | Usually acceptable, but should be intentionally documented and potentially network-restricted |
| `/capabilities` | Pending | Pending | Pending | `pending` | Exposes operational model/tool metadata; should not stay openly reachable without explicit decision |
| `/config` | Pending | Pending | Pending | `pending` | Even with secret redaction, this should not remain publicly accessible |
| `/respond` | Pending | Pending | Pending | `pending` | Critical endpoint; must require internal auth and have rate limits before production acceptance |

Priority:

- this service requires a focused hardening pass before any broader channel rollout

---

## Channel Adapter

### Current HTTP surface

| Endpoint group | Authentication / authz | Rate limit | Origin / exposure | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `/health`, `/channels` | Public by design | Pending review | Pending review | `partial` | Acceptable only if intentionally exposed and preferably network-restricted |
| `/dispatch/meta` | Partial | Pending | Partial | `partial` | Internal token exists; still needs broader audit and likely stronger internal boundary |
| `/webhooks/webchat` | Partial | Pending | Pending | `pending` | Needs explicit abuse protection and trust-boundary definition |
| `/webhooks/email` | Partial | Pending | Pending | `pending` | Real provider callback flow must define validation and abuse limits |
| `/webhooks/email/status` | Partial | Pending | Pending | `pending` | Same as above; especially important for provider trust and replay handling |
| `/webhooks/meta` | Partial | Pending | Pending | `pending` | Requires provider signature/token verification and rate strategy |

Important note:

- current channel-adapter responses set permissive CORS headers
- this is acceptable only temporarily in controlled development, not as production-ready posture

---

## Cross-System Follow-up Matrix

### Highest-priority follow-up

| Area | Why it matters | Priority |
| --- | --- | --- |
| `services/ai-agent-service` hardening | Exposes AI runtime and execution path | P1 |
| `services/channel-adapter` webhook/auth hardening | Entry point for external channels | P1 |
| `backend/src/conversations` and `backend/src/ai` audit | High-impact operational actions and handoffs | P1 |
| `backend/src/inbox` audit | Sync, transport history and operator tooling | P1 |
| Storefront internal/public route classification | Needed before storefront messaging rollout | P2 |
| Admin/backoffice controller role audit | Important but lower urgency than external channel boundaries | P2 |

### Tracking rule

When a group changes from `partial` or `pending` to `covered`, the following must be updated together:

- this matrix
- `docs/tasks.md`
- `docs/progress.md`
- relevant module tests/regressions

