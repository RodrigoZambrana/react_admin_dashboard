# Progress Log

## Iteration 1

### Implemented
- Standalone workspace scaffold under `/ai-platform`
- Independent NestJS backend skeleton with required module boundaries
- Independent React admin frontend skeleton
- Architecture document and infrastructure baseline (`docker-compose.yml`)

### Working
- Workspace structure exists independently from the existing repo apps
- Backend build completes successfully
- Frontend build completes successfully
- Module boundaries are documented before implementation coupling begins

### Technical Debt
- Runtime modules are placeholders without domain logic
- No persistence or AI integration yet

### Next Steps
- Install dependencies
- Validate base builds
- Implement Prisma, tenant context, and repository layer

## Iteration 2

### Implemented
- Prisma schema with `Conversation`, `Message`, `ChatLog`, `PromptVersion`, and `Knowledge`
- Global tenant middleware using `x-tenant-id` or `DEFAULT_TENANT_ID`
- Async tenant context propagation with trace id support
- Prisma tenant policy and middleware for automatic tenant scoping
- Repository layer for conversations, messages, logs, prompts, and knowledge
- Local environment examples for the standalone backend

### Working
- Prisma client generation succeeds
- Prisma schema validation succeeds when `DATABASE_URL` is provided
- Backend build succeeds with repository-only persistence access
- Tenant scoping policy tests pass

### Technical Debt
- No migration files yet; schema is defined but not applied to a live PostgreSQL instance
- Query policy covers current repository usage patterns, but nested Prisma writes are not handled yet
- Logging service is still console-oriented and not yet wired to persistent chat logs

### Next Steps
- Implement AI gateway and interpretation output contract
- Add backend parsing for dates, measurements, and normalization
- Persist interpretation-stage logs through the repository layer

## Iteration 3

### Implemented
- AI gateway with provider abstraction and default mock LLM provider
- Strict interpretation contract returning JSON only
- Interpretation service with schema validation and structured logging
- Date parser using `chrono-node` with English and Spanish parsing paths
- Measurement parser with normalization to canonical units
- Parsing service that converts AI-extracted entities into normalized backend data
- Unit tests for JSON interpretation and backend normalization

### Working
- Backend build succeeds with interpretation and parsing modules wired
- Interpretation provider returns `{ intent, entities, language, confidence }`
- Parsing normalizes Spanish relative dates and measurements
- All backend tests currently pass

### Technical Debt
- Only the mock AI provider is active; external LLM adapters are not implemented yet
- Parsing covers common date and measurement formats but not complex ranges or dimensions
- Interpretation logs are emitted to logger but not yet persisted into `ChatLog`

### Next Steps
- Implement deterministic decision engine and tenant/core routing
- Build tool interface plus `create_booking`, `get_product`, and `create_quote`
- Add prompt version management and connect logging to repositories

## Iteration 4

### Implemented
- Deterministic decision engine with core versus tenant routing
- Explicit decision outputs for `respond`, `clarify`, and `invoke_tool`
- Tool interface with schema-based validation
- Tool engine with logging and dispatch map
- Tenant tools: `create_booking`, `get_product`, and `create_quote`
- Unit tests for decision routing and tool execution

### Working
- Backend build succeeds with decision and tool modules wired
- Booking requests without normalized dates are forced into clarification
- Valid booking requests route deterministically into `create_booking`
- Tool execution validates inputs before running and emits execution logs
- All backend tests currently pass

### Technical Debt
- Tools use static/deterministic stub data instead of live tenant integrations
- Decision rules are deterministic but still compact; tenant-specific rule packs are not externalized yet
- Execution logs are still logger-only and not yet persisted into `ChatLog`

### Next Steps
- Implement prompt storage, versioning, and retrieval
- Implement asynchronous knowledge extraction and storage from logs
- Build the final `/chat/message` orchestration endpoint with persistent stage logging

## Iteration 5

### Implemented
- Prompt system with default templates, storage, versioning, and retrieval
- Asynchronous knowledge extraction queue
- Knowledge classifier that transforms logs into curated knowledge candidates
- Knowledge persistence service backed by repository storage
- Qdrant store service with deterministic vector placeholder for standalone indexing
- Unit tests for knowledge extraction classification

### Working
- Backend build succeeds with prompt and knowledge modules wired
- Prompt service can seed and retrieve active prompt versions
- Knowledge extraction remains asynchronous via in-memory queueing
- Supported execution logs can be classified into booking, quote, product, or general knowledge
- All backend tests currently pass

### Technical Debt
- Prompt service has no admin-facing endpoints yet
- Knowledge queue is in-process only; there is no external worker or retry strategy
- Qdrant vectors use deterministic placeholder embeddings until a real embedding provider is connected

### Next Steps
- Implement Redis-backed conversation memory
- Build `/chat/message` with full input → interpretation → parsing → decision → tool → response → logging → learning flow
- Persist stage logs so knowledge extraction can be triggered from stored traces

## Iteration 6

### Implemented
- Redis-backed memory service with in-process fallback
- Persistent trace logging service backed by `ChatLog`
- Final `/chat/message` orchestration service
- Admin-support endpoints for conversations, logs, trace inspection, and prompts
- End-to-end backend flow: input → interpretation → parsing → decision → execution → response → logging → learning
- Unit test for orchestration flow

### Working
- Backend build succeeds with the full chat pipeline wired
- `/chat/message` orchestration is implemented with deterministic decisions and optional tool execution
- Memory is written per tenant and conversation, with Redis fallback if unavailable
- Stage traces can be persisted and queried by trace id
- Learning is queued asynchronously from stored execution/response logs
- All backend tests currently pass

### Technical Debt
- End-to-end HTTP integration was validated at unit/build level, not against a live PostgreSQL/Redis/Qdrant stack
- AI response generation still uses the mock provider
- Chat orchestration currently uses a single controller; API slicing can be refined later if the surface grows

### Next Steps
- Implement the standalone admin UI against the new backend endpoints
- Add debug viewer, logs viewer, chat interface, and prompt editor without business logic
- Run final full-stack build validation

## Iteration 7

### Implemented
- Standalone React admin UI wired to the new backend endpoints
- Chat UI, debug viewer, logs viewer, prompt editor, and conversation selector
- Native DreamsChat admin dashboard theme ported into the project from `html/template/admin`
- Native DreamsChat public chat asset family vendored from `html/template` for future user-facing chat work
- Frontend asset packs copied into `frontend/public` so the theme now lives inside this project

### Working
- Frontend build succeeds with DreamsChat assets served locally from the standalone app
- Backend build still succeeds after the UI/theme port
- Backend test suite still passes
- The project now contains both admin and public chat visual families natively

### Technical Debt
- The public chat family is vendored and available, but the end-user chat shell itself is not implemented yet
- Theme JS behaviors from the original package were not fully ported; the current integration focuses on native React rendering plus original CSS/assets
- Large vendored asset packs increase frontend repository weight

### Next Steps
- If needed, build the public user chat surface on top of the vendored `dreamschat-chat` assets
- Add live integration validation against PostgreSQL, Redis, and Qdrant containers
- Refine asset pruning once the final UI surface is fixed

## Iteration 8

### Implemented
- Real infrastructure connections for PostgreSQL, Redis, and Qdrant using the standalone environment configuration
- Database validation with applied Prisma migration, verified tables, and tenant-aware persistence checks
- Minimal working `POST /chat/message` endpoint with conversation creation/loading, message persistence, basic deterministic response generation, and persisted trace logging

### Working
- Database operations persist `Conversation`, `Message`, and `ChatLog` records with automatic tenant injection
- `POST /chat/message` responds with the minimal contract and stores both user and assistant messages
- Logging persists the full basic interaction flow in `ChatLog`, and the admin UI remains compatible with the current backend contract

### Technical Debt
- No AI integration yet
- No parsing
- No decision engine

### Next Steps
- Integrate AI interpretation layer

## Iteration 9

### Implemented
- AI Gateway
- Interpretation Service
- integration into chat flow

### Working
- AI returns structured JSON
- interpretation logged
- endpoint stable

### Technical Debt
- prompt not versioned yet
- no parsing normalization
- no decision engine
- no auth implemented

### Next Steps
- parsing layer
- decision engine
- prompt versioning

## Iteration 10

### Implemented
- Deep audit of the abandoned legacy chat/runtime on `develop`
- Permanent legacy audit document for reuse guidance: `ai-platform/docs/legacy-chat-audit.md`
- Explicit reuse versus non-reuse rules for future standalone platform prompts

### Working
- The project now has a documented source of truth for which legacy assets are safe to reimplement
- The audit identifies reusable parsing, tenant-policy, response-guardrail, and QA assets
- The audit explicitly blocks direct reuse of the monolithic runtime, prompt-driven decisioning, and provider-owned tool execution

### Technical Debt
- No legacy assets have been reimplemented in `/ai-platform` yet
- The useful legacy helpers are still only documented, not mapped into concrete standalone backend modules
- Future prompts must still choose one safe increment at a time when mining legacy functionality

### Next Steps
- Use the audit during the next safe backend increment, starting with parsing-oriented legacy helpers only

## Iteration 11

### Implemented
- Live `ParsingService` activation in `/chat/message` immediately after interpretation
- New persisted `parsing` stage in the trace log flow
- Canonical parsed contract with flat stable intents and backend-owned normalized entities
- Dimension normalization support for `x`/`por` style pairs in addition to dates and generic measurements

### Working
- Live flow is now `input -> interpretation -> parsing -> response -> logging`
- `/chat/message` keeps the current response contract while parsing runs internally
- Parsing output is persisted to `ChatLog` and ready for future deterministic decisioning
- Backend normalization now covers date, measurement, and dimension signals from the active interpretation layer

### Technical Debt
- Decision routing is still inactive in the live path
- Tool execution is still inactive in the live path
- Response generation still ignores parsed context beyond stable logging and metadata
- Prompt storage is still not reconnected to the active interpretation/parsing chain

### Next Steps
- Activate deterministic `DecisionService` on top of the canonical parsed contract
- Wire tools only after decision routing is live and validated
- Refine dimension heuristics and add broader parsing coverage for ranges and multi-item measurement lists

## Iteration 12

### Implemented
- Hardened Prisma tenant policy so context tenant scope always overrides caller-supplied `tenantId` filters
- Hardened tenant data injection so caller-supplied `tenantId` values are overwritten on create, createMany, update, updateMany, and upsert payloads
- Expanded tenant policy tests to cover empty where clauses, normal filters, matching/mismatching tenant filters, and caller-supplied tenant data in write operations

### Working
- Automatic tenant isolation at the Prisma policy boundary is now non-bypassable for the covered query and mutation actions
- Existing `/chat/message` orchestration tests continue to pass unchanged
- Backend and frontend builds continue to pass after tenant policy hardening

### Technical Debt
- Tenant enforcement still lives at the Prisma middleware layer and is not additionally protected by database-level constraints or RLS
- `DecisionService` remains inactive in the live chat path
- Auth and admin authorization are still not implemented

### Next Steps
- Activate deterministic `DecisionService` on top of the already isolated interpretation/parsing flow
- Evaluate whether database-level tenant protections should complement middleware enforcement
- Keep closing each validated iteration with a descriptive commit for traceable delivery context

## Iteration 13

### Implemented
- Hardened temporal parsing so `DateParser` only normalizes bounded temporal expressions from AI candidates or safe message-level extraction
- Added tests for valid bounded expressions in Spanish and English, plus rejection of noisy fragments from dimensions and arbitrary candidate noise
- Tightened parsing assertions so live normalized booking date evidence stays deterministic
- Wired `DecisionService` into the live orchestration immediately after parsing
- Persisted a dedicated `decision` trace stage with deterministic backend routing output while keeping tools inactive
- Added deterministic response handling aligned to decision outcomes without activating tools

### Working
- Valid expressions such as `mañana`, `mañana a las 3`, and `tomorrow` still normalize correctly
- Noisy fragments from dimension or measurement text no longer become normalized date evidence
- Backend temporal normalization is now safer to use as input for deterministic booking decisions
- Live flow is now `input -> interpretation -> parsing -> decision -> response -> logging`
- Decision outputs are persisted for inspection with `domain`, `action`, `toolName`, `reasonCode`, and `missingFields`
- Clarification decisions now ask for missing information deterministically
- `invoke_tool` decisions now return neutral acknowledgements and do not imply successful execution

### Technical Debt
- Tool execution remains inactive in runtime
- AI response generation remains inactive in the live path
- Prompt version storage is still not connected to decision-aware response generation
- Temporal normalization still covers only bounded basic expressions, not a broader scheduling grammar

### Next Steps
- Re-run full backend and frontend validation on the end-to-end decision-aware flow
- Activate tool execution only after deterministic decision routing is fully stable
- Add AI response generation later as a wording layer on top of backend-approved decisions

## Iteration 14

### Implemented
- Added backend-owned temporal locale resources under `backend/src/resources/temporal/locales`
- Added a reusable `TemporalLocaleRegistryService` to load locale catalogs dynamically from resource files
- Added backend build-time resource copying so runtime resource catalogs are available from `dist`
- Added a shared `TemporalExpressionService` so temporal extraction mechanics are centralized and locale-resource driven
- Refactored `DateParser` to consume locale resources instead of embedded temporal lexicons
- Refactored the mock AI provider to extract temporal candidates and locale hints through the shared backend-managed temporal resources
- Added architecture-oriented tests for the locale registry and temporal expression service
- Added locale-resolution coverage showing regional locale codes resolve through backend-managed temporal resources

### Working
- Temporal locale support now has a standalone resource structure that can be extended per locale without changing parser mechanics
- The backend has a single registry entry point for resolving supported temporal locales
- Runtime packaging now includes temporal resource catalogs instead of depending on source-only files
- Date normalization now depends on locale resources plus deterministic parsing mechanics, not embedded human-language word lists
- The mock interpretation provider still produces date candidates for supported locales without owning temporal vocabulary in runtime code
- Supported locales still normalize expected expressions correctly through data-driven resources
- Lexical support can be changed by editing resource catalogs without changing extraction logic
- Backend and frontend builds pass after the temporal-resource refactor
- Backend test coverage now includes registry/resource architecture validation in addition to behavior checks

### Technical Debt
- The live pipeline behavior remains coupled to previously activated decision routing outside this roadmap step
- Locale resources are file-based today; prompt/version governance for resource evolution is still pending
- The final live pipeline still needs a future cleanup pass to align the roadmap narrative with the branch's already-active decision layer

### Next Steps
- Use this temporal-resource foundation as the prerequisite for any future temporal parsing expansion or locale additions
- When the roadmap resumes decision work, keep decision behavior unchanged and rely on the new resource-driven temporal normalization
- Introduce governance/versioning for backend locale resources when prompt/config versioning is revisited

## Iteration 15

### Implemented
- Added a backend-owned `TemporalLocaleProvider` abstraction for temporal locale access
- Promoted the temporal locale resource schema into the shared temporal contract layer
- Prepared the temporal subsystem to decouple parser logic from any concrete storage implementation
- Added a filesystem-backed `TemporalLocaleProvider` implementation as the current concrete adapter
- Refactored temporal extraction mechanics to depend on `TemporalLocaleProvider` instead of a concrete registry service
- Moved temporal-module wiring to export the provider abstraction while keeping filesystem loading behind the provider boundary

### Working
- The temporal subsystem now has an explicit provider boundary for locale resources
- Resource schema validation is now part of the shared temporal contract instead of being buried in a concrete loader
- Temporal parsing services no longer know about filesystem-backed loading details
- Existing runtime behavior remains unchanged at this milestone
- Parser and mock-provider tests now prove the runtime can consume non-filesystem temporal locale providers
- This abstraction is now the intended prerequisite for the next roadmap step, `Live Decision Activation`

### Technical Debt
- Some integration-oriented tests still instantiate the filesystem-backed provider directly for repository-backed locale coverage
- Locale resources are still repository-versioned files and are not yet governed by prompt/config versioning
- The live pipeline behavior remains coupled to the branch's already-active decision layer, which is outside the scope of this abstraction step

### Next Steps
- Use this abstraction as the fixed dependency boundary before any future temporal parsing expansion or locale additions
- Resume roadmap work on `Live Decision Activation` without changing temporal parser dependencies again
- Introduce governance/versioning for temporal locale resources when config/prompt storage is revisited

## Roadmap Alignment Note

### Implemented
- Re-aligned roadmap guidance so the legacy chat audit becomes a mandatory planning reference for future iterations, not just an implementation-time consultation
- Established `Runtime Managed Resources` as a transversal roadmap line for temporal resources, prompts, critical configs, and later knowledge metadata when applicable
- Documented that future roadmap waves must consider recommended legacy solutions for backend, admin operations, QA/test tooling, and user-facing chat concepts only when they fit the new architecture

### Working
- Future iteration planning now has an explicit rule: mine the legacy audit before defining the next roadmap wave
- Legacy assets are now recognized as inputs for sequencing and scope design, not only for code-level reuse
- The project keeps the legacy branch as a reference library while preserving the standalone platform as the only valid runtime architecture target

### Technical Debt
- `Runtime Managed Resources` is still only a roadmap line and not yet implemented as a common platform capability
- Admin ABMs for critical resources, knowledge, and chat testing remain pending
- The roadmap still needs concrete execution waves that connect backend runtime completion with admin and user-facing product surfaces

### Next Steps
- Use the legacy audit explicitly when defining the next roadmap wave around `Runtime Managed Resources`
- Keep future roadmap proposals aligned with reusable legacy strengths such as response guardrails, deterministic conversation-state concepts, admin test workflows, and QA assets
- Continue rejecting legacy patterns that violate backend-owned decisioning, backend-owned execution, automatic tenant isolation, or modular layer separation

## Iteration 16

### Implemented
- Introduced shared `Runtime Managed Resources` contracts for lifecycle status, runtime providers, and bootstrap seed sources
- Unified managed-resource lifecycle semantics around `DRAFT`, `ACTIVE`, and `ARCHIVED`
- Extended Prisma persistence with a dedicated `TemporalLocaleVersion` model for versioned temporal catalogs
- Updated tenant-scoped persistence wiring so managed temporal locale versions follow the same automatic isolation policy as other tenant-owned data
- Replaced the live temporal runtime dependency with a managed persisted provider backed by `TemporalLocaleVersion`
- Reduced filesystem temporal resources to idempotent bootstrap seed inputs only
- Refactored temporal parsing, the mock AI provider, and the live parsing chain to consume async provider-backed temporal resources
- Added managed prompt template seed/bootstrap sources under backend-owned resources
- Reconnected live AI prompt retrieval to persisted prompt versions through a managed runtime provider, removing code-backed prompt defaults from the active path
- Updated the AI gateway to consume managed interpretation and response prompts without changing the live `/chat/message` contract
- Added a unified backend admin boundary for runtime-managed resources with prompt and temporal locale endpoints under `/admin/runtime-resources/*`
- Added service-layer admin surfaces for temporal locale versioning and active prompt/locale inspection without coupling controllers to repositories

### Working
- The codebase now has a reusable backend contract for versioned runtime-managed resources instead of ad hoc per-subsystem lifecycle definitions
- Prompt versions and temporal locale versions now share explicit managed-resource lifecycle semantics
- Prisma client generation succeeds against the new managed-resource schema foundation
- Temporal runtime resolution no longer reads filesystem catalogs directly in the active parsing path
- Temporal bootstrap is idempotent per tenant: when no managed temporal versions exist, the seed source hydrates persisted active versions once
- Backend and frontend builds pass after the temporal runtime refactor, and the full backend test suite passes with async temporal parsing active
- Prompt bootstrap is also idempotent per tenant, and AI gateway tests now verify managed prompt retrieval instead of code-backed templates
- Code search confirms the old code-backed prompt template path is gone from runtime code
- Code search confirms filesystem access for temporal and prompt resources is limited to bootstrap seed loaders, not active runtime consumers
- The backend now exposes future-admin resource endpoints without breaking the existing `/chat/message` or legacy `/prompts` contracts

### Technical Debt
- The new admin resource endpoints are still open because auth/admin guards remain out of scope for this wave
- Prompt and temporal resource management are now aligned, but critical configs and governed knowledge metadata still need migration onto the same pattern
- The legacy `/prompts` endpoints are still present for compatibility and can be retired once the admin UI migrates to the new runtime-resource boundary

### Next Steps
- Use this governed resource base to enable `Live Tool Execution` without leaking configuration or prompt ownership into runtime orchestration
- Add `AI Response on Approved Context` on top of the managed response prompt path now that prompt retrieval is runtime-governed
- Extend the same runtime-managed pattern to critical config storage and governed knowledge metadata
- Migrate the admin UI to `/admin/runtime-resources/*` and add auth/admin guards when the security wave starts

## Iteration 17

### Implemented
- Audited the current branch state against the architecture docs before defining the next delivery sequence
- Corrected documentation mismatches so the docs now reflect the real live flow: `input -> interpretation -> parsing -> decision -> response -> logging`
- Corrected prompt/runtime documentation so managed prompt retrieval and managed date-time locale resources are described as already landed platform capabilities
- Added an executive roadmap for Waves 2 through 5 covering:
  - Live Tool Execution
  - Deterministic Conversation Continuity
  - AI Response On Approved Context
  - Governance, QA, Learning, And Productization Readiness
- Embedded legacy-audit guidance per wave so each future wave starts from reusable legacy strengths without importing invalid runtime patterns

### Working
- The roadmap is now aligned with the actual branch state instead of outdated pre-Wave-1 assumptions
- Waves 2 to 4 are now clearly framed as core backend runtime completion
- Wave 5 is now clearly framed as governance, QA, learning, and productization readiness rather than premature UI implementation
- Each roadmap wave now includes dependencies, architecture constraints, legacy contributions to mine, completion criteria, and explicit next-wave enablement

### Technical Debt
- This iteration updates planning and documentation only; no runtime behavior changed
- The live pipeline still stops before `execution` and `learning`
- Admin UI ABMs, public user chat productization, and auth/admin guards remain future work outside this roadmap update

### Next Steps
- Start Wave 2 with deterministic live tool execution and execution-stage trace activation
- Preserve the current sequencing: execution before conversation continuity, continuity before AI response generation, and governance/QA expansion after the full runtime path is live
- Keep using `docs/legacy-chat-audit.md` as a mandatory planning input before opening each new wave

## Iteration 18

### Implemented
- Activated the live backend execution path after deterministic decisioning through `ToolExecutionService` and `ToolEngineService`
- Added structured execution outcomes for successful, validation-failed, unknown-tool, and runtime-failed executions
- Persisted the `execution` stage in trace logs with validated input summaries, execution result summaries, and failure details
- Introduced a minimal backend `ChatResponsePolicyService` boundary so execution-aware deterministic responses no longer expand wording debt inside `ChatOrchestratorService`
- Kept tenant context injection automatic during execution by resolving `tenantId` and `traceId` inside the execution service instead of caller-managed routing

### Working
- The live `/chat/message` flow now runs `input -> interpretation -> parsing -> decision -> execution -> response -> logging`
- Approved `invoke_tool` decisions now execute real backend tools for bookings, quotes, and product requests
- Unknown tools, validation failures, and execution failures now fail safely without breaking the endpoint contract
- Execution traces are now observable per conversation with backend-truth payloads instead of placeholder pending-execution behavior
- Backend build, backend tests, and frontend build all pass with the execution layer active

### Technical Debt
- Response wording is still deterministic backend copy and remains intentionally minimal until Wave 4 activates AI response generation on approved context
- Tool execution currently returns synchronous mock/business-placeholder payloads rather than real tenant integrations
- Execution governance is active, but deterministic conversation continuity and follow-up state are still missing for multi-turn execution flows

### Next Steps
- Refine the execution-aware response policy without moving wording logic back into the orchestrator
- Expand test coverage around execution-aware chat outcomes and tenant-safe execution traces as Wave 2 closes
- Use the new authoritative execution outputs to start Wave 3, `Deterministic Conversation Continuity And State`, without reintroducing model-owned routing
