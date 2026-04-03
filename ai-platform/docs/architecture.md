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
  - deterministic backend decisioning
  - deterministic backend tool execution for approved tenant actions
  - execution-stage trace persistence with validated input and outcome summaries
  - a minimal backend response-policy boundary that keeps execution-aware wording outside the orchestrator until Wave 4
  - managed runtime resources for prompts and date-time locale resources
  - minimal admin-ready backend resource surfaces
- Not active in the live path yet:
  - AI response generation from backend-approved context
  - asynchronous learning from stored logs

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

## Roadmap: Waves 2 To 5

### Roadmap Framing

- Waves 2 through 4 complete the core conversational backend runtime
- Wave 5 focuses on operability, QA, learning, and productization readiness rather than UI implementation itself
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

Current live interactions persist the active subset of stages, and future waves will activate `execution` and `learning` in the same canonical shape.

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
