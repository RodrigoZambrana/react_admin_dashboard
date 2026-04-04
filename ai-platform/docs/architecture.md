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
- `ResponseFallbackModule`: governed deterministic fallback catalogs for backend-safe response drafts
- `PersistenceModule`: Prisma repositories and tenant enforcement
- `ParsingModule`: normalization of dates, measurements, and entities
- `RuntimeConfigModule`: abstraction over managed runtime configuration and safe env-backed secret resolution, keeping provider/runtime selection portable while leaving room for future repository-backed tenant/auth settings
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
  - `/admin/runtime-resources/critical-configs`
  - `/admin/runtime-resources/knowledge-metadata`
  - `/admin/runtime-resources/response-fallbacks`
- Roadmap terminology should converge on `date-time-locale-resources` as the product-facing name for the resource family currently implemented under `backend/src/modules/temporal/*`
- Additional families now aligned to the same pattern:
  - critical configs
  - governed knowledge metadata
  - response fallback catalogs

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
  - AI-generated responses grounded in backend-approved context, with response guardrails and deterministic fallback catalogs
  - governed asynchronous learning from persisted traces/logs
  - managed runtime resources for:
    - prompts
    - date-time locale resources
    - critical configs
    - knowledge metadata
    - response fallback catalogs
  - Wave 6 admin operations UI over real backend governance surfaces for all managed-resource families
- Not active as product surfaces yet:
  - Wave 7 knowledge and chat test center workflows
  - Wave 8 public/user chat product UI
  - the async turn-intake / cancellation / typing capability required before or within Wave 8

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
- Wave 3 hardcode/locale audit result:
  - existing user-facing locale branching debt remains isolated in `ChatResponsePolicyService`
  - no new locale-specific branching was introduced in the touched continuity, decision, orchestration, or execution-carryover path

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
- Wave 5 completes governance, learning, provider/runtime configuration hardening, and backend/product-platform readiness needed before major UI delivery
- Waves 6 through 8 deliver the admin and public product surfaces on top of the stabilized runtime and governance contracts
- Wave 9 closes security, centralized QA/E2E, role separation, and production hardening
- A wave is not considered complete only because implementation and tests pass; every reported wave completion must also pass a dedicated code-review gate that verifies functional requirements and architectural alignment across all touched layers
- Completion review findings must feed the next implementation prompt and planning context by default; only blocker findings are allowed to stop progression into the next wave
- Every wave must mine the legacy audit only for reusable concepts, validation assets, and operator workflows that fit the new architecture
- No wave may introduce:
  - model-driven decisions
  - provider-owned tool execution
  - monolithic orchestration
  - manual tenant routing

### Current Roadmap Status On This Branch

- Waves 1 through 7 are closed on this branch
- Wave 8 is now phased on this branch:
  - Wave 8.0, `Gateway Structural Cleanup For User Chat Readiness`, is closed
  - Wave 8.1, `Async Turn Intake, Cancellation, And Presence Foundation`, is the next delivery phase
  - Wave 8.2, `User Chat Product UI`, remains gated on the async capability from Wave 8.1
- The gateway-specific prerequisite is now absorbed:
  - provider registration/resolution no longer lives inline in `AiGatewayService`
  - prompt/protocol assembly no longer lives inline in `AiGatewayService`
- A later prompt-governance prioritization remains explicit:
  - structural response/interpretation protocol contracts, output field names, enum values, and JSON-shape guarantees must remain backend-owned rather than freely admin-editable
  - policy/editorial prompt instructions can later become governed/admin-editable behind managed resources
  - `AiPromptAssemblyService` is now the correct boundary for that future split, but the split itself is not a blocker for Wave 8.1
  - code-owned fallback protocol behavior must continue to exist even if governed prompt policy becomes editable later
- The remaining explicit prerequisite before public chat rollout is the async turn-intake / cancellation / typing capability mined from legacy user-chat behavior
- Wave 9 remains the centralized QA, security, roles, E2E, and production-hardening wave; Wave 7 now provides concrete operator workflows and regression journeys for that later hardening work

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
5. Main implementation scope: define the backend-approved response context contract; activate live response generation through `AiGatewayService`; add approved-draft rewrite, response guardrails, grounding/closure checks, provider trace logging, and deterministic fallback reasons; keep deterministic fallbacks when response generation fails.
6. Architecture constraints: AI may rewrite wording only; it may not decide actions, missing fields, tenant policy, or tool usage; response prompts stay runtime-managed; the active runtime response path must flow through a backend-owned response service that builds approved context, calls AI, enforces guardrails, and falls back safely without pushing wording logic back into the orchestrator.
7. Legacy contributions that should be mined: approved-draft rewrite concepts from `generate-response.js`; response guardrails from `validate-response.js`; provider-call tracing from `provider-call-trace.js`; grounding audit and closure checks from `grounding-audit.js` and related QA assets.
8. Expected user/platform value: user-facing replies become clearer, more natural, and multilingual while staying grounded in backend-approved outcomes.
9. Completion criteria: live flow reaches `response` through AI wording over approved context; outputs never imply unexecuted actions; fallback responses stay deterministic; trace logs capture response audit metadata; endpoint contract remains non-breaking.
10. Explicit next-wave enablement: provides grounded transcripts, response audits, and managed prompt usage data needed for Wave 5 governance, provider/runtime hardening, and learning activation.

### Wave 5: Governance, Learning, Provider Configuration, And Productization Readiness

1. Wave name: Governance, Learning, Provider Configuration, And Productization Readiness
2. Strategic objective: make the completed backend pipeline operable through governed critical resources, learning activation, provider/runtime configuration hardening, and backend contracts that support later admin UI and public chat productization.
3. Why it happens now: once execution and AI response are live, the primary risk shifts from missing runtime stages to governed rollout, configuration portability, learning control, and operator readiness.
4. Dependency on previous waves: depends on Waves 1 through 4 so governance and learning can operate on the real end-to-end pipeline rather than placeholders.
5. Main implementation scope: activate asynchronous learning from stored logs under governed extraction policies; migrate critical configs, governed knowledge metadata, and fallback response catalogs onto the runtime-managed resource pattern; standardize AI gateway/runtime provider configuration so the active client configuration is not implicitly tied to one provider family; expand backend governance surfaces needed by later admin UI and user UI delivery.
6. Architecture constraints: learning remains async and backend-owned; no raw knowledge dumping; provider/runtime configuration must remain backend-governed and provider-agnostic at the configuration boundary; admin surfaces stay separate from runtime orchestration; this wave must not become the centralized QA wave.
7. Legacy contributions that should be mined: structured tenant/domain concepts from `runtime-tenant-policy.js`; legacy knowledge-service concepts that fit the new governance model; user-facing chat experience concepts from `webchat.adapter.js` only as product/API guidance, not as runtime architecture.
8. Expected user/platform value: safer governed rollout, portable provider/runtime configuration, live learning readiness, and backend readiness for future admin ABMs and public chat product surfaces.
9. Completion criteria: learning is live and observable; critical configs, governed knowledge metadata, and fallback response catalogs follow the runtime-managed resource pattern; AI provider/runtime configuration is standardized behind a provider-agnostic contract instead of provider-specific environment assumptions; admin-ready backend endpoints cover resource governance and runtime operations needed by later UI waves.
10. Explicit next-wave enablement: directly enables Wave 6 by giving the admin UI stable backend ABM contracts for prompts, date-time-locale-resources, critical configs, knowledge metadata, and response fallback catalogs; also enables Wave 9 by ensuring later auth/roles, centralized QA, and hardening work operate over governed runtime surfaces instead of placeholder configs.

### Wave 6: Admin Operations UI

1. Wave name: Admin Operations UI And Managed Resource ABMs
2. Strategic objective: convert the admin-ready backend governance surfaces into real operator-facing admin workflows for prompts, date-time-locale-resources, critical configs, and trace-driven runtime operations.
3. Why it happens now: once Waves 1 through 5 have stabilized the runtime and its governed resource contracts, operators need a first-class admin UI instead of relying on direct endpoint usage.
4. Dependency on previous waves: depends on Waves 1 through 5, especially the runtime-managed resource pattern, admin-ready backend surfaces, and governance/runtime contracts delivered in Wave 5.
5. Main implementation scope: build modular admin sections for managed resource CRUD/versioning/publishing; expose trace/resource inspection workflows; connect the frontend to `/admin/runtime-resources/*` and related governance endpoints; begin retiring compatibility-only admin paths once equivalent flows are live.
6. Architecture constraints: the UI must remain a thin client over backend-governed contracts; no browser-owned decision logic; no direct datastore access; no new legacy runtime coupling; naming should converge toward `date-time-locale-resources` when backend compatibility allows it; the visual/admin layout must replicate the DreamsChat template exactly from `/Users/rodrigo/Personal/Proyectos/react projects/dreamschat-v2.8.4`, adapting only data wiring and capabilities rather than reinterpreting the layout.
7. Legacy contributions that should be mined: legacy operator workflow concepts, admin dashboard patterns already audited in the legacy review, and trace inspection flows that improve operator efficiency without copying legacy runtime behavior.
8. Expected user/platform value: operators can manage prompts, date-time-locale-resources, and critical configs safely through productized UI flows instead of manual backend calls or filesystem/bootstrap procedures.
9. Completion criteria: admin UI can manage managed prompts, date-time-locale-resources, critical configs, knowledge metadata, and response fallback catalogs through backend-governed lifecycles; trace/resource inspection supports routine operator workflows; compatibility-only admin paths have a defined retirement path.
10. Explicit next-wave enablement: provides the operator shell needed for governed knowledge workflows and an admin chat test center in Wave 7; establishes the managed-resource operator surface that must exist before the async turn-intake / cancellation / typing capability is productized before or within Wave 8; and gives Wave 9 stable admin surfaces for later auth, roles, centralized QA, and production hardening.

### Wave 7: Knowledge And Chat Test Center UI

1. Wave name: Knowledge And Chat Test Center UI
2. Strategic objective: give operators governed knowledge-management tooling and a dedicated admin chat test center for replay, trace review, corpora-driven evaluation, and prompt/resource inspection.
3. Why it happens now: after the admin operations shell exists, the next product gap is safe operator testing and knowledge stewardship before exposing the experience broadly to end users.
4. Dependency on previous waves: depends on Waves 1 through 6, especially Wave 5 governance/backend readiness and Wave 6 admin UI foundations.
5. Main implementation scope: add governed knowledge metadata ABMs; expose chat replay/test-center workflows; support trace comparison, corpora execution, and resource/prompt inspection from the admin UI; connect these surfaces to governed backend admin endpoints instead of ad hoc runtime hooks.
6. Architecture constraints: knowledge remains governed and backend-owned; test-center actions must use explicit admin contracts; no direct mutation of runtime state outside managed workflows; UI must not reintroduce monolithic runtime assumptions.
7. Legacy contributions that should be mined: legacy operator test flows, multitenant smoke scenarios, and later legacy Playwright-ready journeys once the frontend surfaces are stable enough to use them as meaningful references.
8. Expected user/platform value: operators can validate behavior before rollout, manage governed knowledge safely, and inspect failures using productized workflows instead of manual log digging.
9. Completion criteria: governed knowledge metadata can be managed from the admin UI; operators can run chat tests, inspect traces, compare outcomes, and execute QA flows through the test center; backend QA surfaces are exercised through real admin workflows.
10. Explicit next-wave enablement: this wave is now closed on the branch and de-risks the public chat experience in Wave 8 by giving operators replay, trace, and governed-knowledge workflows over real backend contracts; it also keeps the carried `AiGatewayService` registry/scaffolding debt explicit as a structural prerequisite to absorb before or within Wave 8, preserves the async turn-intake / cancellation / typing requirement before public-chat rollout, and supplies concrete operator journeys for the centralized QA and security/E2E hardening work in Wave 9.

### Wave 8: User Chat Product UI

1. Wave name: User Chat Product UI
2. Strategic objective: deliver the end-user conversational product surface on top of the stabilized backend runtime, governed resources, and operator tooling built in earlier waves.
3. Why it happens now: once runtime correctness, governance, operator validation flows, and the required async turn-intake / cancellation / typing behavior are in place, the platform can expose a productized chat surface without using the frontend as a substitute for backend control.
4. Dependency on previous waves: depends on Waves 1 through 7, especially the approved-context response path, operator test-center feedback loops, admin-managed resources, the async turn-intake / cancellation / typing capability mined from legacy user-chat behavior, and the carried gateway-structure cleanup remaining explicit from Wave 7 closeout.
5. Main implementation scope: build the public/user chat shell; integrate transcript, turn status, pending-turn handling, cancellation, and recovery states with the live backend pipeline; expose safe multilingual/user-facing presentation surfaces; prepare tenant-facing rollout flows without duplicating backend logic in the client; replicate the DreamsChat chat layout exactly from `/Users/rodrigo/Personal/Proyectos/react projects/dreamschat-v2.8.4` while replacing the underlying behavior with the new platform capabilities.
6. Architecture constraints: the UI must remain presentation-only; no client-side decisioning, tool routing, or tenant-scoping shortcuts; user-facing wording still comes from backend-approved response flows; any locale presentation logic must avoid new hardcoded linguistic assumptions in the browser; the target is exact layout replication of the template, not a visual approximation; the user chat surface must not be shipped as a purely synchronous request/response shell.
7. Legacy contributions that should be mined: user-facing chat experience concepts from `webchat.adapter.js`, legacy conversation UX lessons documented in the audit, and later Playwright/E2E journeys as regression references once the user shell stabilizes.
8. Expected user/platform value: the platform gains an actual end-user product surface instead of only internal/operator tooling, enabling real conversational product rollout.
9. Completion criteria: end users can interact with the live pipeline through a productized chat UI; core and tenant-backed flows are visible in a stable user shell; operator/admin workflows remain separate from public UX concerns.
10. Explicit next-wave enablement: gives Wave 9 stable admin and user surfaces on which to enforce roles, auth, and end-to-end production hardening.

#### Wave 8 Delivery Phases

- Wave 8.0: Gateway Structural Cleanup For User Chat Readiness
  - closed on this branch
  - removes provider registry branching and prompt/protocol scaffolding concentration from `AiGatewayService`
  - preserves the live `/chat/message` contract while preparing the backend for async intake and public-chat delivery
- Wave 8.1: Async Turn Intake, Cancellation, And Presence Foundation
  - next phase
  - must land before or within public chat rollout
  - carries forward the legacy-backed requirement for realistic wait, pending-turn cancellation, and typing / awaiting-reply presence
  - must not expand the still-carried prompt-governance debt in `AiPromptAssemblyService`; structural protocol contract remains backend-owned while editable policy wording stays a later prioritization item
- Wave 8.2: User Chat Product UI
  - depends on Waves 1 through 7 plus Wave 8.1
  - must replicate the DreamsChat public layout exactly while running on top of the stabilized async backend intake foundation instead of the current synchronous shell

### Wave 9: Centralized QA, Security, Roles, E2E, And Production Hardening

1. Wave name: Centralized QA, Security, Roles, E2E, And Production Hardening
2. Strategic objective: centralize regression and QA strategy, finalize authentication and role separation, guard admin access, and harden rollout across the now-complete backend and UI surfaces.
3. Why it happens now: centralized QA, security, roles, and E2E hardening are most effective after both admin and user product surfaces are real and stable enough to validate end-to-end behavior instead of placeholders.
4. Dependency on previous waves: depends on Waves 1 through 8, including stable runtime, admin tooling, knowledge/test-center UI, and user-facing chat product flows.
5. Main implementation scope: centralize QA strategy and regression execution; implement auth and role boundaries; guard admin routes and managed-resource mutations; add Playwright/E2E regression for admin and user flows; finalize multitenant smoke coverage; harden rollout, observability, and tenant onboarding/operational readiness.
6. Architecture constraints: security remains backend-enforced; automatic tenant isolation cannot be weakened by client context; centralized QA suites must assert canonical backend truth rather than UI-only heuristics; hardening must not collapse stage separation or reintroduce manual routing shortcuts.
7. Legacy contributions that should be mined: legacy Playwright/E2E journeys, multitenant smoke tests, operator QA flows, and other rollout-oriented assets identified in the legacy audit, always rewritten against the new platform contracts rather than copied as-is.
8. Expected user/platform value: the platform becomes ready for controlled rollout with authenticated admin operations, tenant-safe user access, and centralized regression suites that protect the full product surface.
9. Completion criteria: centralized QA strategy is active; auth and role separation are active; admin surfaces are guarded; Playwright/E2E suites cover critical admin and user journeys; multitenant regression and operational hardening are in place for production rollout.
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

Current live interactions already persist `input`, `interpretation`, `parsing`, `decision`, `execution`, `response`, and `logging` in the synchronous request path. `learning` is now active as an asynchronous backend-owned stage triggered only from persisted `logging` records, so knowledge extraction never depends on transient orchestration state or model-owned callbacks.

Each active stage emits structured records with trace id, tenant id, duration, outcome, and payload summary.

The `interpretation` stage persists:

- raw AI response
- parsed JSON
- provider and model metadata
- fallback/error details when AI is unavailable or invalid

The `response` stage persists:

- approved backend response context
- deterministic approved draft used for rewrite/fallback
- governed fallback catalog resolution behind locale-aware managed resources
- provider and model metadata for response generation
- parsed AI response JSON
- guardrail outcomes and deterministic fallback reason when fallback was required

The `learning` stage persists:

- source log id and source stage
- governed policy/config versions used for extraction
- completed, skipped, or failed async learning outcomes
- stored knowledge identifiers and embedding references when extraction succeeds

## Security Preparation

- Current API mode remains open for this iteration
- Future Bearer authentication is planned through `SecurityModule`
- Planned admin-only endpoints:
  - `/prompts`
  - `/logs`
  - `/conversations`
  - `/admin/runtime-resources/prompts`
  - `/admin/runtime-resources/temporal-locales`
  - `/admin/runtime-resources/critical-configs`
  - `/admin/runtime-resources/knowledge-metadata`
  - `/admin/runtime-resources/response-fallbacks`
- AI runtime selection now comes from governed `ai_runtime` critical config, while secret material can still resolve from env-backed credential references behind `RuntimeConfigModule`
- Future secure API key storage and tenant config retrieval will move behind repository-backed configuration services without changing controller or orchestrator layers

## Delivery Strategy

- Iterate by stage
- Validate each stage with build and tests
- Before accepting a stage or wave as complete, perform a dedicated code review that checks:
  - functional requirement coverage
  - alignment with the target architecture and roadmap intent
  - layer responsibility boundaries
  - multi-tenant enforcement and tenant-safe data access
  - language-hardcoding and locale-limited logic debt in touched paths
  - observability coverage for the affected pipeline stages
- Treat deviations found in that review as explicit findings:
  - blockers when they violate non-negotiable architecture or break the next wave
  - technical debt when they are acceptable to defer without compromising the roadmap
- Do not stop platform progress after a completed wave just because review findings exist; carry non-blocking findings into the next wave prompt, roadmap context, and closeout documentation
- Update `docs/progress.md` after every iteration

## Frontend Theme Strategy

- The standalone frontend owns copied DreamsChat assets locally inside `frontend/public`
- Admin operations UI uses the DreamsChat admin dashboard shell and native asset pack as a first-class in-project dependency
- Public chat visuals are also vendored now so the future end-user shell can be built without re-importing external packages
- The source-of-truth visual template for both admin and public chat UI is `/Users/rodrigo/Personal/Proyectos/react projects/dreamschat-v2.8.4`
- Future UI waves must replicate that template layout exactly and swap in the new platform capabilities behind it, rather than building a merely similar variant
- Legacy user-chat behaviors around human-like wait, pending-turn cancellation, and typing/awaiting-reply remain an explicit prerequisite before or within Wave 8; they must inform the future public chat runtime but are intentionally out of scope for Wave 6
