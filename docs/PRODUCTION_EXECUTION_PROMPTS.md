# Production Execution Prompts

## Purpose

This document turns the production-readiness plan into an executable loop of Codex prompts.

Each iteration should:

- focus on one deliverable only
- preserve a clean baseline
- end with explicit validation
- leave a short progress note so the next run resumes with context

Baseline commit for this loop:

- `23ac603a` - `feat: consolidate chat platform and secure channel configs`

## Operating rules

- Do not mix multiple domains in the same iteration unless the failure is truly cross-cutting.
- Prefer repo documentation and runtime evidence over assumptions.
- If validation fails, document the blocker before moving to the next prompt.
- Each iteration should update one or more of:
  - `docs/PROJECT_STATUS.md`
  - `docs/EXECUTION_ROADMAP.md`
  - `docs/QA_CENTER.md`
  - `docs/security.md`
  - `docs/security-infrastructure.md`

## Final Production Split

This repository now treats production as two independent product lines with explicit ownership:

- `ecommerce` and `admin` are the production-facing commerce stack.
- `ai-platform` is the standalone chat platform stack.
- The ai-platform UI (`5179`) stays local/testing-only unless a separate deployment target is explicitly approved.
- Production ecommerce/admin deployments use:
  - `deploy/docker-compose.prod.yml`
  - `deploy/docker-compose.testing.yml`
  - `app.yaml`
- Chat platform runtime and channel configuration live in `ai-platform`, but production exposure must be through backend/contracts and not through the local admin UI.
- For this delivery, the production chat scope is manual replies only; automated responses and auto-reply behavior stay out of scope until a later iteration explicitly reintroduces them.
- Shared behavior between the stacks must be integrated through explicit API contracts, not duplicated ownership or env-driven shadow state.

This split is final for the current execution loop and should be treated as the baseline for all following iterations.

## Iteration 1 - Security baseline

### Prompt

```text
Audit the security baseline for the current repository and runtime. Build a concrete inventory of tracked secrets, env files, secure-config ownership, auth/origin exposure, and public-vs-internal endpoint boundaries across ecommerce, admin, chat platform, and channel-adapter. Identify what is source of truth in DB, what still depends on env, and what must be blocked or rotated before production. Record only evidence-backed findings and update the security documentation with the current status.
```

### Deliverables

- inventory of tracked environment files and sensitive values
- source-of-truth map for secure config, env, and fallback behavior
- endpoint protection status by service
- list of production blockers
- documentation update with the current baseline

### Validation

- `git ls-files` confirms which env files are tracked
- `rg` inventory confirms which sensitive keys exist in repo config
- `docs/endpoint-protection-audit-matrix.md` and `docs/security.md` are aligned with the findings
- no production-secret assumption is left undocumented

### Current status

- completed baseline audit
- `deploy/env/backend.dev.env`, `deploy/env/frontend.dev.env`, and `deploy/env/storefront.dev.env` are tracked in git
- `deploy/env/backend.dev.env` currently contains operational local values for SMTP, IMAP, Google, Mercado Pago, JWT, cookies, and config encryption
- `SecureConfig` remains the intended production/runtime authority for sensitive settings; env files are bootstrap or dev-only boundaries, not the production source of truth
- production/testing example env files remain placeholder-based
- `docs/endpoint-protection-audit-matrix.md` still marks several backend/admin/AI/channel surfaces as `partial` or `pending`
- `node scripts/check-env.mjs` passes, so the current risk is not missing keys but ownership of tracked development secrets and runtime boundaries
- next prompt: deployment topology closure

### Exit criteria

- the security ownership model is explicit
- the production secret boundary is documented
- the next iteration can proceed without guessing where credentials live

## Iteration 2 - Deployment topology closure

### Prompt

```text
Close the deployment topology for production. Ensure ecommerce, admin, and chat platform have explicit production boundaries, and keep the ai-platform UI out of the production deployment while preserving local/testing access. Verify compose manifests, port exposure, and environment wiring. Document the final deployment split and any remaining exceptions.
```

### Deliverables

- production compose topology by service
- exclusion of non-prod-only UIs and helpers from production
- verified port and origin mapping
- deployment documentation update

### Validation

- `docker compose -f deploy/docker-compose.prod.yml config`
- `docker compose -f deploy/docker-compose.testing.yml config`
- `docker compose -f ai-platform/docker-compose.yml config`
- documented confirmation that prod does not publish the ai-platform admin UI

### Current status

- completed topology closure
- `deploy/docker-compose.prod.yml` only defines `frontend`, `backend`, `storefront`, and optional `db`; it does not include the `ai-platform` UI
- `deploy/docker-compose.testing.yml` follows the same split and also keeps `ai-platform` out of the main production topology
- `ai-platform/docker-compose.yml` remains a separate local/testing stack and publishes its UI on `5179`
- `app.yaml` still deploys only `frontend` and `backend`, which matches the current production boundary for the ecommerce/admin stack
- production split formalized in this document
- next prompt: ecommerce readiness

### Exit criteria

- prod topology is explicit
- local/testing-only surfaces are not deployed to prod

## Iteration 3 - Ecommerce readiness

### Prompt

```text
Validate ecommerce readiness for production. Cover checkout end-to-end, login and registration, payment integrations, public product display, and SEO-critical content. Turn every manual issue into a reproducible regression or documented blocker.
```

### Deliverables

- end-to-end commerce smoke scenarios
- checkout/payment validation notes
- product display and content readiness notes
- SEO-critical page inventory

### Validation

- browser-based smoke on catalog -> cart -> checkout -> payment -> confirmation
- login/registration smoke
- build and route checks for storefront

### Next steps

- If the checkout smoke exposes a structural gap, verify the existing branch history before adding a new guard or duplicate flow.
- Verify, update, and complement the test cases so they cover the widest possible surface, including independent checks and ecommerce end-to-end flows.
- If the smoke passes, move straight into admin readiness with the same baseline and the same real-user flow discipline.

## Iteration 4 - Admin readiness

### Prompt

```text
Validate the administrative surface for production. Confirm role-based navigation, access restrictions, visibility and management of customers, orders, payments, products, CMS content, and imported chat conversations from the chat platform. Remove or neutralize any legacy chat ownership still present in the ecommerce admin.
```

### Deliverables

- admin role and nav audit
- customer/order/payment/product/CMS audit
- chat conversations consumed from chat platform only
- list of legacy admin chat paths removed or hidden

### Validation

- role-protected route checks
- admin conversation list/detail checks
- build and runtime smoke on the admin app

### Next steps

- Confirm that conversations, settings, and channel surfaces all resolve from the intended backend owners.
- Verify, update, and complement the test cases so admin coverage expands with each iteration, including isolated checks and the ecommerce/admin integration path where it matters.
- If any admin view still depends on legacy chat tables or endpoints, remove that dependency before moving to the chat-platform iteration.

## Iteration 5 - Chat platform readiness

### Prompt

```text
Validate the chat platform as an independent product. Ensure channels, manual messaging actions, configuration management, and secure runtime operation are production-ready. Keep the ai-platform UI local/testing-only unless explicitly approved for a separate deployment target.
```

### Deliverables

- channel configuration matrix
- manual messaging action coverage
- runtime and secret management audit
- deployment boundary for ai-platform UI

### Validation

- backend health and admin configuration smoke
- channel-specific route checks
- confirmation that production uses backend/contracts, not the local test UI

### Next steps

- Verify that each channel surface has an explicit owner, a persisted config source, and a clear fallback boundary.
- Verify, update, and complement the test cases so channel coverage keeps matching the real channel matrix and the most important integration flows.
- If a channel screen still depends on legacy bootstrap or env-only values, migrate it to the secure runtime path before advancing.

## Iteration 6 - QA and regression loop

### Prompt

```text
Turn all production-relevant findings into repeatable QA coverage. Ensure every regression discovered during manual validation becomes a durable test block or documented exception. Keep the QA center, manifest, and status docs aligned with the current system.
```

### Deliverables

- new or updated QA blocks
- updated regression coverage
- status notes for blocked or intentionally deferred cases

### Validation

- `node tools/qa/run-qa.mjs --list`
- `node tools/qa/run-qa.mjs --all` or targeted blocks
- QA center reflects the latest accepted baseline

### Next steps

- Convert every newly observed regression into a repeatable QA block.
- Verify, update, and complement the test cases so the QA surface stays broad enough to catch independent regressions and end-to-end ecommerce regressions.
- Keep the QA coverage aligned with the current baseline before starting any new product iteration.
- Do not begin manual close-out until every case not marked `VERIFICADA` has been created, validated, updated, and executed or has an explicitly documented exception.
- Exclude auto-response automation suites (`wording registry`, `hybrid intent`, `grounding`, `auto-reply`) from this delivery; they may be tested separately, but they do not gate the manual-only production readiness loop.

## Iteration handoff format

At the end of every iteration, record:

- `Baseline`
- `Change`
- `Validation`
- `Residual risk`
- `Next prompt`
