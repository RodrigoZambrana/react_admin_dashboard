# AI Conversational Platform Architecture

## Goals

- Standalone conversational platform inside `/ai-platform`
- Hard separation between interpretation, decision, execution, and response generation
- Core versus tenant capabilities enforced in backend rules
- Deterministic decisioning with AI limited to interpretation and response generation
- Multi-tenant isolation across HTTP, persistence, memory, and knowledge layers

## Runtime Topology

- `frontend/`: standalone React admin UI
- `backend/`: standalone NestJS API
- PostgreSQL via Prisma for durable data
- Redis for short-term conversation memory
- Qdrant for semantic knowledge retrieval
- Vendored DreamsChat visual packs:
  - admin shell from `html/template/admin`
  - public chat pack from `html/template`

## Layer Separation

### 1. Interpretation Layer

- Module: `InterpretationModule`
- Responsibility: convert user input into structured JSON
- Input: raw user message plus optional previous messages
- Output:

```json
{
  "intent": "string",
  "entities": {},
  "language": "string",
  "confidence": 0.0
}
```

- Constraint: no tool execution and no business decisions
- Runtime behavior:
  - the interpretation service normalizes language codes and intent names
  - if AI fails, it falls back to `GENERAL_CONVERSATION` with empty entities and zero confidence

### 2. Decision Layer

- Module: `DecisionModule`
- Responsibility: deterministic routing based on normalized interpretation
- Output:
  - core response
  - clarification
  - tenant tool route
- Constraint: no AI-based decisions

### 3. Execution Layer

- Modules: `ToolsModule`, `MemoryModule`, `KnowledgeModule`
- Responsibility:
  - run validated tools
  - manage Redis memory
  - retrieve and persist classified knowledge
- Constraint: only executes instructions produced by the decision engine

### 4. Response Generation Layer

- Module: `AiGatewayModule`
- Responsibility:
  - build prompts
  - call the configured LLM provider
  - validate structured model output
  - log request and response diagnostics
- Constraint: may not select tools or business actions
- Rule: AI is called only from `AiGatewayModule`

## Core vs Tenant Domains

### Core

- general conversation
- clarification

### Tenant

- quotes
- bookings
- ecommerce

## Backend Modules

- `ApiModule`: REST controllers and orchestration endpoints
- `InterpretationModule`: AI interpretation service
- `DecisionModule`: deterministic rules and tool routing
- `ToolsModule`: tool interface and execution engine
- `AiGatewayModule`: provider abstraction for LLM calls
- `MemoryModule`: Redis-backed conversation memory
- `KnowledgeModule`: asynchronous knowledge extraction and storage
- `LoggingModule`: pipeline logging and observability
- `PromptModule`: prompt storage, retrieval, and versioning
- `PersistenceModule`: Prisma repositories and tenant enforcement
- `ParsingModule`: normalization of dates, measurements, and entities
- `RuntimeConfigModule`: abstraction over env-backed runtime configuration with future DB handoff points for AI keys, tenant configs, and prompts
- `SecurityModule`: placeholder security planning for future Bearer auth and admin-only endpoint guards
- `RuntimeResources`: shared contracts for versioned runtime-managed resources with swappable providers and bootstrap seed sources

## Runtime Managed Resources

- Critical runtime resources must resolve through backend-owned provider boundaries, never directly from files or hardcoded runtime templates
- Each resource family keeps explicit persistence models when that preserves type clarity, but shares the same lifecycle semantics:
  - `DRAFT`
  - `ACTIVE`
  - `ARCHIVED`
- Runtime-managed resources must support:
  - automatic tenant scoping
  - versioned history
  - audit metadata (`createdBy`, `createdAt`, provenance metadata)
  - bootstrap seeding from repository-owned resource files when no managed version exists yet
  - future admin mutation without changing parser, orchestration, or AI gateway logic
- Current Wave 1 applications of this pattern:
  - prompts
  - date-time locale resources
- Date-time locale resources now resolve through a managed runtime provider backed by persisted versions
- Filesystem locale files remain only as bootstrap seed inputs when a tenant has no managed temporal versions yet
- Prompt templates now follow the same pattern: filesystem bootstrap seeds, persisted versioned runtime source of truth, and provider-backed retrieval from the AI gateway
- Minimal future-admin backend surfaces now live under:
  - `/admin/runtime-resources/prompts`
  - `/admin/runtime-resources/temporal-locales`
- Roadmap terminology should converge on `date-time-locale-resources` as the product-facing name for the resource family currently implemented under `backend/src/modules/temporal/*`
- Future families expected to align to the same pattern:
  - critical configs
  - governed knowledge metadata

## Current Platform State

- Live `/chat/message` flow on this branch:
  - `input -> interpretation -> parsing -> decision -> execution -> response -> logging`
- Live today:
  - tenant-safe conversation/message/log persistence
  - AI interpretation with managed prompt retrieval
  - backend parsing with managed date-time locale resources
  - persisted backend conversation continuity/state for active lanes
  - continuity-aware deterministic decisioning and execution input reuse across turns
  - deterministic backend decisioning
  - deterministic backend tool execution for approved tenant actions
  - execution-stage trace persistence with validated input and outcome summaries
  - deterministic backend responses grounded in approved decision and execution truth
  - a minimal backend response-policy boundary that keeps execution-aware wording outside the orchestrator until Wave 4
  - managed runtime resources for prompts and date-time locale resources
  - minimal admin-ready backend resource surfaces
- Not active in the live path yet:
  - AI response generation from backend-approved context
  - asynchronous learning from stored logs

## Deterministic Conversation State

- Wave 3 introduces a dedicated `ConversationState` persistence model instead of hiding continuity in Redis memory or message metadata
- Continuity state is tenant-scoped automatically and exists only when a conversation has actionable continuity context
- The model is intentionally compact and lane-aware:
  - current lane when relevant
  - approved facts when relevant
  - pending facts when relevant
  - missing fields when relevant
  - next useful field when relevant
  - last approved backend action/result when relevant
- General conversation turns must be able to proceed without any persisted task state
- The continuity contract is future-compatible with backend-owned actions such as:
  - `respond`
  - `clarify`
  - `retrieve_core_knowledge`
  - `handoff`
  - `close_turn`
- Stale-fact invalidation happens in backend continuity logic before decisioning when a turn explicitly changes lane
- Continuity may enrich deterministic backend context for decision and execution, but it may not let the model own routing or state transitions

## Target Live Pipeline

1. API receives tenant-scoped user message.
2. Logging captures input.
3. Interpretation produces strict JSON.
4. Parsing normalizes AI-extracted entities.
5. Decision engine selects deterministic route.
6. Tool engine executes validated tenant action if needed.
7. AI gateway generates response text from approved backend context.
8. Logging persists stage-by-stage trace.
9. Knowledge service asynchronously extracts reusable knowledge from logs.

## Managed Prompt Runtime

- Interpretation and response prompts now resolve through managed `PromptVersion` storage, not code-backed runtime defaults
- Filesystem prompt files exist only as bootstrap seeds when a tenant has no managed prompt versions yet
- Prompt retrieval is already wired into the live AI gateway path for interpretation and prepared for future response generation activation

## Roadmap: Waves 2 To 9

### Roadmap Framing

- Waves 2 through 4 complete the core conversational backend runtime
- Wave 5 completes governance, QA, learning, and backend/product-platform readiness needed before major UI delivery
- Waves 6 through 8 deliver the admin and public product surfaces on top of the stabilized runtime and governance contracts
- Wave 9 closes security, role separation, end-to-end regression, and production hardening
- Every wave must mine the legacy audit only for reusable concepts, validation assets, and operator workflows that fit the new architecture
- No wave may introduce:
  - model-driven decisions
  - provider-owned tool execution
  - monolithic orchestration
  - manual tenant routing

### Wave 2: Live Tool Execution

1. Wave name: Live Tool Execution And Execution Governance
2. Strategic objective: activate deterministic backend tool execution for approved tenant actions so the live pipeline reaches `execution` without giving action control to the LLM.
3. Why it happens now: the branch already has stable decisioning, managed prompts, and managed date-time locale resources; the next missing runtime stage is backend-owned execution.
4. Dependency on previous waves: depends on Wave 1 runtime-managed resources, hardened tenant scoping, active parsing, and active deterministic decisioning.
5. Main implementation scope: wire `ToolEngineService` into the live orchestration after `DecisionService`; persist `execution` traces; add deterministic success/failure contracts; introduce idempotent execution handling; connect tool policy inputs to runtime-managed tenant/config resources where needed.
6. Architecture constraints: only backend-approved `invoke_tool` decisions may execute; controllers stay orchestration-only; no model tool calling; automatic tenant isolation remains mandatory; current `/chat/message` contract must remain non-breaking.
7. Legacy contributions that should be mined: tenant/business policy modeling from `runtime-tenant-policy.js`; role/tool policy ideas from `role.config.ts` and `role-policies.ts`; multitenant smoke scenarios from legacy QA assets; explicitly reject `openai-provider.js` style provider-owned tool execution.
8. Expected user/platform value: bookings, quotes, and product requests move from neutral acknowledgement to real backend action; traceability and operator confidence increase because execution becomes explicit and auditable.
9. Completion criteria: live flow becomes `input -> interpretation -> parsing -> decision -> execution -> response -> logging`; execution logs include validated input, result, and failure status; tool execution remains backend-only; tenant isolation holds across execution paths.
10. Explicit next-wave enablement: creates authoritative execution outputs and pending-action records required for deterministic follow-up continuity in Wave 3.

### Wave 3: Deterministic Conversation Continuity

1. Wave name: Deterministic Conversation Continuity And State
2. Strategic objective: introduce a compact backend-owned conversation state model so follow-up turns can continue bookings, quotes, and product flows without re-deciding from scratch.
3. Why it happens now: once execution is live, continuity becomes the next correctness bottleneck; repeated re-interpretation without backend state will degrade multi-turn reliability.
4. Dependency on previous waves: depends on Wave 2 execution outcomes, existing Redis-backed memory, and the current interpretation/parsing contracts.
5. Main implementation scope: define a reduced canonical conversation-state contract; persist pending facts, missing fields, next useful field, and lane continuity; add stale-fact invalidation rules; expose state inspection in traces/admin-ready backend surfaces; feed deterministic state into backend decisioning without giving the model routing ownership.
6. Architecture constraints: state must remain smaller and stage-specific, not a new monolithic runtime object; no AI-owned state transitions; no manual tenant/session injection; observability must stay stage-canonical.
7. Legacy contributions that should be mined: `canonical-intermediate-contract.js` for fields and semantics only; `conversation-state.js` for lane continuity, next useful field, and stale-fact invalidation concepts; follow-up QA scenarios from legacy smoke tests.
8. Expected user/platform value: fewer repeated questions, safer follow-up handling, and more reliable completion of multi-turn quote and booking flows.
9. Completion criteria: deterministic state is persisted and reused across turns; clarification continuity works across turns; state transitions are traceable; changing lanes invalidates stale facts safely; no LLM decisions are introduced.
10. Explicit next-wave enablement: produces approved backend context and stable follow-up state for safe AI response generation in Wave 4.

### Wave 4: AI Response On Approved Context

1. Wave name: AI Response On Approved Context
2. Strategic objective: activate AI-generated user-facing responses only after backend interpretation, parsing, decision, execution, and conversation-state approval have produced a safe response context.
3. Why it happens now: response generation becomes safe only after execution and continuity are deterministic; before that, AI wording would be forced to compensate for missing backend truth.
4. Dependency on previous waves: depends on Wave 1 managed prompts, Wave 2 execution results, and Wave 3 deterministic conversation continuity.
5. Main implementation scope: define the backend-approved response context contract; activate live response generation through `AiGatewayService`; add approved-draft rewrite, response guardrails, grounding/closure checks, and provider trace logging; keep deterministic fallbacks when response generation fails.
6. Architecture constraints: AI may rewrite wording only; it may not decide actions, missing fields, tenant policy, or tool usage; response prompts stay runtime-managed; logging must persist prompt version, provider/model data, and guardrail outcomes.
7. Legacy contributions that should be mined: approved-draft rewrite concepts from `generate-response.js`; response guardrails from `validate-response.js`; provider-call tracing from `provider-call-trace.js`; grounding audit and closure checks from `grounding-audit.js` and related QA assets.
8. Expected user/platform value: user-facing replies become clearer, more natural, and multilingual while staying grounded in backend-approved outcomes.
9. Completion criteria: live flow reaches `response` through AI wording over approved context; outputs never imply unexecuted actions; fallback responses stay deterministic; trace logs capture response audit metadata; endpoint contract remains non-breaking.
10. Explicit next-wave enablement: provides grounded transcripts, response audits, and managed prompt usage data needed for Wave 5 governance, QA, and learning activation.

### Wave 5: Governance, QA, Learning, And Productization Readiness

1. Wave name: Governance, QA, Learning, And Productization Readiness
2. Strategic objective: make the completed backend pipeline operable through governed critical resources, learning activation, admin-ready QA surfaces, and backend contracts that support later admin UI and public chat productization.
3. Why it happens now: once execution and AI response are live, the primary risk shifts from missing runtime stages to rollout safety, evaluation, and operator control.
4. Dependency on previous waves: depends on Waves 1 through 4 so governance and QA can operate on the real end-to-end pipeline rather than placeholders.
5. Main implementation scope: activate asynchronous learning from stored logs under governed extraction policies; migrate critical configs and governed knowledge metadata onto the runtime-managed resource pattern; expand backend surfaces for test runs, corpora evaluation, trace review, and runtime-resource administration; finalize backend contracts required by future admin UI and user UI delivery.
6. Architecture constraints: learning remains async and backend-owned; no raw knowledge dumping; admin surfaces stay separate from runtime orchestration; QA tooling must validate stage-specific contracts instead of reintroducing monolithic runtime coupling.
7. Legacy contributions that should be mined: QA/regression assets and corpora from legacy tests and `tools/qa`; multitenant smoke cases; structured tenant/domain concepts from `runtime-tenant-policy.js` and legacy knowledge services; user-facing chat experience concepts from `webchat.adapter.js` only as product/API guidance, not as runtime architecture.
8. Expected user/platform value: safer rollout, tenant-operable governance, measurable quality, and backend readiness for future admin ABMs and public chat product surfaces.
9. Completion criteria: learning is live and observable; critical configs and governed knowledge metadata follow the runtime-managed resource pattern; admin-ready backend endpoints cover resource governance and QA/test workflows; regression suites cover multitenancy, grounding, closure, and follow-up continuity.
10. Explicit next-wave enablement: enables later product tracks such as admin UI ABMs, public chat UX delivery, security hardening, and tenant onboarding workflows without changing core runtime architecture.

### Wave 6: Admin Operations UI

1. Wave name: Admin Operations UI And Managed Resource ABMs
2. Strategic objective: convert the admin-ready backend governance surfaces into real operator-facing admin workflows for prompts, date-time-locale-resources, critical configs, and trace-driven runtime operations.
3. Why it happens now: once Waves 1 through 5 have stabilized the runtime and its governed resource contracts, operators need a first-class admin UI instead of relying on direct endpoint usage.
4. Dependency on previous waves: depends on Waves 1 through 5, especially the runtime-managed resource pattern, admin-ready backend surfaces, and QA/governance contracts delivered in Wave 5.
5. Main implementation scope: build modular admin sections for managed resource CRUD/versioning/publishing; expose trace/resource inspection workflows; connect the frontend to `/admin/runtime-resources/*` and related governance endpoints; begin retiring compatibility-only admin paths once equivalent flows are live.
6. Architecture constraints: the UI must remain a thin client over backend-governed contracts; no browser-owned decision logic; no direct datastore access; no new legacy runtime coupling; naming should converge toward `date-time-locale-resources` when backend compatibility allows it.
7. Legacy contributions that should be mined: legacy operator workflow concepts, admin dashboard patterns already audited in the legacy review, QA panel ideas from `tools/qa`, and trace inspection flows that improve operator efficiency without copying legacy runtime behavior.
8. Expected user/platform value: operators can manage prompts, date-time-locale-resources, and critical configs safely through productized UI flows instead of manual backend calls or filesystem/bootstrap procedures.
9. Completion criteria: admin UI can manage managed prompts, date-time-locale-resources, and critical configs through backend-governed lifecycles; trace/resource inspection supports routine operator workflows; compatibility-only admin paths have a defined retirement path.
10. Explicit next-wave enablement: provides the operator shell needed for governed knowledge workflows and an admin chat test center in Wave 7.

### Wave 7: Knowledge And Chat Test Center UI

1. Wave name: Knowledge And Chat Test Center UI
2. Strategic objective: give operators governed knowledge-management tooling and a dedicated admin chat test center for replay, trace review, corpora-driven evaluation, and prompt/resource inspection.
3. Why it happens now: after the admin operations shell exists, the next product gap is safe operator testing and knowledge stewardship before exposing the experience broadly to end users.
4. Dependency on previous waves: depends on Waves 1 through 6, especially Wave 5 QA/backend readiness and Wave 6 admin UI foundations.
5. Main implementation scope: add governed knowledge metadata ABMs; expose chat replay/test-center workflows; support trace comparison, corpora execution, and resource/prompt inspection from the admin UI; connect these surfaces to the backend QA and governance endpoints instead of ad hoc runtime hooks.
6. Architecture constraints: knowledge remains governed and backend-owned; test-center actions must use explicit QA/admin contracts; no direct mutation of runtime state outside managed workflows; UI must not reintroduce monolithic runtime assumptions.
7. Legacy contributions that should be mined: legacy QA corpora, multitenant smoke scenarios, admin/operator test flows, and later legacy Playwright-ready journeys once the frontend surfaces are stable enough to use them as meaningful references.
8. Expected user/platform value: operators can validate behavior before rollout, manage governed knowledge safely, and inspect failures using productized workflows instead of manual log digging.
9. Completion criteria: governed knowledge metadata can be managed from the admin UI; operators can run chat tests, inspect traces, compare outcomes, and execute QA flows through the test center; backend QA surfaces are exercised through real admin workflows.
10. Explicit next-wave enablement: de-risks the public chat experience in Wave 8 and supplies concrete regression journeys for the security/E2E hardening work in Wave 9.

### Wave 8: User Chat Product UI

1. Wave name: User Chat Product UI
2. Strategic objective: deliver the end-user conversational product surface on top of the stabilized backend runtime, governed resources, and operator tooling built in earlier waves.
3. Why it happens now: once runtime correctness, governance, and operator validation flows are in place, the platform can expose a productized chat surface without using the frontend as a substitute for backend control.
4. Dependency on previous waves: depends on Waves 1 through 7, especially the approved-context response path, QA/test-center feedback loops, and admin-managed resources.
5. Main implementation scope: build the public/user chat shell; integrate transcript, turn status, and recovery states with the live backend pipeline; expose safe multilingual/user-facing presentation surfaces; prepare tenant-facing rollout flows without duplicating backend logic in the client.
6. Architecture constraints: the UI must remain presentation-only; no client-side decisioning, tool routing, or tenant-scoping shortcuts; user-facing wording still comes from backend-approved response flows; any locale presentation logic must avoid new hardcoded linguistic assumptions in the browser.
7. Legacy contributions that should be mined: user-facing chat experience concepts from `webchat.adapter.js`, legacy conversation UX lessons documented in the audit, and later Playwright/E2E journeys as regression references once the user shell stabilizes.
8. Expected user/platform value: the platform gains an actual end-user product surface instead of only internal/operator tooling, enabling real conversational product rollout.
9. Completion criteria: end users can interact with the live pipeline through a productized chat UI; core and tenant-backed flows are visible in a stable user shell; operator/admin workflows remain separate from public UX concerns.
10. Explicit next-wave enablement: gives Wave 9 stable admin and user surfaces on which to enforce roles, auth, and end-to-end production hardening.

### Wave 9: Security, Roles, E2E, And Production Hardening

1. Wave name: Security, Roles, E2E, And Production Hardening
2. Strategic objective: finalize authentication, role separation, guarded admin access, end-to-end regression coverage, and rollout hardening across the now-complete backend and UI surfaces.
3. Why it happens now: security, roles, and E2E hardening are most effective after both admin and user product surfaces are real and stable enough to validate end-to-end behavior instead of placeholders.
4. Dependency on previous waves: depends on Waves 1 through 8, including stable runtime, admin tooling, knowledge/test-center UI, and user-facing chat product flows.
5. Main implementation scope: implement auth and role boundaries; guard admin routes and managed-resource mutations; add Playwright/E2E regression for admin and user flows; finalize multitenant smoke coverage; harden rollout, observability, and tenant onboarding/operational readiness.
6. Architecture constraints: security remains backend-enforced; automatic tenant isolation cannot be weakened by client context; E2E suites must assert canonical backend truth rather than UI-only heuristics; hardening must not collapse stage separation or reintroduce manual routing shortcuts.
7. Legacy contributions that should be mined: legacy Playwright/E2E journeys, multitenant smoke tests, operator QA flows, and other rollout-oriented assets identified in the legacy audit, always rewritten against the new platform contracts rather than copied as-is.
8. Expected user/platform value: the platform becomes ready for controlled rollout with authenticated admin operations, tenant-safe user access, and regression suites that protect the full product surface.
9. Completion criteria: auth and role separation are active; admin surfaces are guarded; Playwright/E2E suites cover critical admin and user journeys; multitenant regression and operational hardening are in place for production rollout.
10. Explicit next-wave enablement: enables controlled tenant onboarding, rollout scaling, and ongoing delivery without revisiting the core platform architecture.

## Multi-Tenant Enforcement

- Tenant id enters through HTTP middleware
- Tenant context stored in request scope / async context
- Prisma middleware injects and validates tenant filters
- Repositories are the only persistence access path
- Redis and Qdrant keys are prefixed by tenant id

## Observability

Canonical stage model for the final pipeline:

- input
- interpretation
- parsing
- decision
- execution
- response
- logging
- learning

Current live interactions already persist `input`, `interpretation`, `parsing`, `decision`, `execution`, `response`, and `logging` in the canonical shape, and future waves will activate `learning` in the same canonical shape.

Each active stage emits structured records with trace id, tenant id, duration, outcome, and payload summary.

The `interpretation` stage persists:

- raw AI response
- parsed JSON
- provider and model metadata
- fallback/error details when AI is unavailable or invalid

## Security Preparation

- Current API mode remains open for this iteration
- Future Bearer authentication is planned through `SecurityModule`
- Planned admin-only endpoints:
  - `/prompts`
  - `/logs`
  - `/conversations`
  - `/admin/runtime-resources/prompts`
  - `/admin/runtime-resources/temporal-locales`
- AI keys currently come from env-backed runtime config and are isolated behind `RuntimeConfigModule`
- Future secure API key storage and tenant config retrieval will move behind repository-backed configuration services without changing controller or orchestrator layers

## Delivery Strategy

- Iterate by stage
- Validate each stage with build and tests
- Update `docs/progress.md` after every iteration

## Frontend Theme Strategy

- The standalone frontend owns copied DreamsChat assets locally inside `frontend/public`
- Admin operations UI uses the DreamsChat admin dashboard shell and native asset pack
- Public chat visuals are also vendored now so the future end-user shell can be built without re-importing external packages
