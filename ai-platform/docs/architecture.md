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
- Approved response context now distinguishes between:
  - explicit support
  - partial support
  - unavailable right now
- Backend guardrails remain responsible for blocking unsupported detail claims and wrong unspecified-detail axes before a generated answer can surface

## Core, Tenant Capability, And Tenant Resource Boundaries

The branch now treats the platform as three explicit layers:

- core platform
- tenant capability modules
- tenant resources

The authoritative boundary lock lives in:

- `docs/core-tenant-boundaries.md`
- `docs/core-tenant-corpus-implementation-plan.md`

### Core Platform

Core is the reusable conversational substrate shared by all tenants.

Core includes:

- conversational substrate
- continuity
- grounding
- source selection
- contextual closure
  - advisory continuity
  - document continuity
  - short follow-up topic carryover before full lane lock
  - observability
  - async intake
  - document-processing capability

Important clarification:

- document processing is core capability
- document content is not core truth
- uploaded document content remains tenant-scoped approved knowledge
- corpus frequency from one tenant never upgrades a business workflow into core runtime behavior

### Tenant Capability Modules

Tenant capability modules are optional business workflows layered on top of the conversational core.

Current examples:

- booking / scheduling
- quote / measurements
- product catalog lookup
- support / post-sale

Important clarification:

- corpus-derived labels such as `quote_request`, `structured_measurements`, and `appointment_scheduling` are tenant capability behavior patterns, not proof of core behavior
- these modules may be frequent in one tenant corpus without becoming universal platform logic

### Tenant Resources

Tenant resources are tenant-scoped approved sources of business truth.

Examples:

- uploaded documents
- uploaded structured catalogs
- external REST-backed catalog sources
- catalogs
- pricing
- payment terms
- hours
- references
- policies
- other approved tenant-scoped business truth

Important clarification:

- these resources must remain outside core business logic
- they stay usable only through approved backend-governed boundaries
- the real corpus is analysis/regression input only and must never become active runtime knowledge
- tenant resource source forms now explicitly include:
  - plain text / markdown / html
  - PDF
  - DOCX
  - XLSX
  - URL-backed fetches
  - structured catalog uploads
  - REST-backed external connectors

## Backend Modules

- `ApiModule`: REST controllers and orchestration endpoints
- `CatalogModule`: tenant-neutral catalog source boundary with uploaded structured and REST adapters
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
- `ChannelControlModule`: managed channel configuration control plane for Meta, WhatsApp QR, email, webchat, and shared routing defaults
- `SecurityModule`: placeholder security planning for future Bearer auth and admin-only endpoint guards
- `TenantCapabilitiesModule`: backend-owned tenant capability resolution from managed runtime configuration with compatibility-safe fallback
- `TenantResourcesModule`: reusable tenant resource adapters for multi-format document and structured catalog ingestion
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
- Critical config coverage now also includes tenant-operable capability activation through the managed `tenant_capabilities` resource key, preserving a compatibility bootstrap fallback without keeping static activation as the source of truth

## Structured Document Knowledge Ownership

The document knowledge path now distinguishes clearly between:

- extraction
- retrieval
- response presentation

### Extraction Owns

- neutral document parsing/chunking substrate
- source-derived text parsing
- semantic chunk boundaries
- structural pattern detection
- claim/entity classification
- support class assignment
- provenance metadata
- extraction scope classification:
  - `core_universal`
  - `domain_profile`
  - `tenant_only`

Extraction may persist:

- atomic values
- normalized values
- structured claim payloads
- supported axes
- unspecified axes

Extraction must not persist customer-facing response prose.
The base extractor must also remain domain-neutral:

- it may own generic document structure such as page/sheet/heading detection
- it may not own product/catalog semantic axes by default
- domain extraction must run through explicit modular extraction profiles

Examples of allowed persisted claim shape:

- profile-owned product claims such as materials -> extracted values such as `PVC`, `aluminio`
- profile-owned operation modes -> extracted values such as `manuales`, `motorizadas`
- profile-owned color variety -> axis support plus unspecified exact color options
- profile-owned suitability -> bounded-inference relation target derived from source text

### Tenant Conversational Guidance Layer

Approved tenant documents may also contribute a separate tenant-scoped guidance layer.

This layer is distinct from factual claims and from quote-field workflow notes:

- factual claims
  - document facts and scoped relations used as business truth
- workflow notes
  - tenant-scoped intake and quote-field signals
- guidance notes
  - tenant-scoped conversational orientation such as:
    - informative-flow guidance
    - quote-transition guidance
    - confirmation guidance
    - organic response patterns
    - comparison guidance

Guidance notes must:

- be extracted from approved tenant documents
- be persisted as structured metadata, not hardcoded in prompts
- refresh automatically on re-ingestion of the active document
- shape wording, sequencing, and next-step suggestions only
- never override factual claims, support mode, or execution truth

Response generation now composes:

- base prompt / safety / contract layers
- tenant-grounded factual layer from persisted claims
- tenant-grounded workflow layer from persisted workflow notes
- tenant-grounded conversational guidance layer from persisted guidance notes

## Relational Approved Document Knowledge

The approved document path now supports a relational claim shape for cases where flat axis summaries lose important scope.

Current relational direction:

- `subject`
- `axis`
- `value`
- `applies_to`
- `support_class`
- `evidence`
- `provenance`

This is explicitly meant to improve scoped questions such as:

- colors for one material but not another
- installments for one payment method
- visit cost for one location
- service/coverage facts for one family or branch of the document

### Knowledge Layers

The extractor must not flatten all approved document content into one claim bucket.

Three layers are now distinguished:

1. Factual relational claims
   - product families/types
   - material-scoped options
   - payment methods
   - installment counts
   - location/coverage facts
   - service-offer facts
2. Prudence / coverage metadata
   - exact values not fully specified
   - known unsupported-detail boundaries
   - caution conditions for overclaim-sensitive axes
3. Workflow metadata
   - fields required to move from informative conversation into quote/next-step flow
   - safe operational prompts such as approximate measures, quantity, or variant

The runtime knowledge view and persistence model must keep those layers separate.

### Ownership Rules

- Extraction owns structure, classification, support class, evidence, provenance, and relational packaging
- Extraction does not own customer-facing response phrasing
- Profiles may own reusable domain semantics
- Tenant values must still come only from document content
- Prudence/workflow metadata must not be flattened into factual product/location/payment claims

### Structural Parsing Expectations

Relational extraction depends on structural document parsing rather than document-specific phrase coupling.

The parser must recognize, generically:

- numbered headings such as `4.` or `4.1.`
- heading-plus-body paragraphs where a heading line is followed by content in the same paragraph block
- list/bullet entries under the active section
- parent/child section boundaries that allow subject replacement and scoped extraction

This keeps the platform oriented toward reusable document extraction behavior instead of solving one tenant document with literal wording rules.

Examples of disallowed extraction ownership:

- `Trabajamos con PVC y aluminio`
- `Tenemos variedad de colores`
- `Puede ser una opción adecuada para exteriores`

### Extraction Profiles

The document knowledge path now separates:

- a neutral base extractor
- a neutral extraction orchestrator
- modular domain extraction profiles
- a backend-owned profile registry
- a backend-owned profile resolver

Current modular profile:

- `product_catalog`

Profile activation is backend-owned and capability/context-aware:

- the neutral orchestrator builds structural blocks, provenance metadata, support summaries, and retrieval projections
- the profile registry owns the list of available extraction profiles
- the profile resolver selects active profiles from:
  - tenant capability context
  - source/document metadata
  - resource classification when available
- the current product/catalog profile activates when the tenant capability context enables product catalog lookup, or when document metadata explicitly requests that profile
- the base extractor still works without any domain profile
- a tenant in another SaaS domain does not inherit product axes such as:
  - `materials`
  - `product_types`
  - `color_options`
  - `operation_modes`
  - `suitability`

This keeps:

- parsing
- chunking
- provenance
- support-class assignment
- generic document structure
- extraction orchestration

inside core, while moving domain semantics into bounded, replaceable modules.

### Externalized Profile Configuration

Domain profiles now keep their locale vocabulary/config outside TS constants and inside governed resource files by `profile + locale`, for example:

- `backend/src/resources/document-extraction-profiles/product_catalog/es.json`
- `backend/src/resources/document-extraction-profiles/product_catalog/en.json`

These resources are:

- declarative
- system-owned
- compiled by a backend loader into bounded runtime matchers
- not exposed to operators as raw regex authoring

This keeps:

- reusable structural behavior in code
- locale/domain config in resources
- tenant truth only in uploaded document content

Platform-owned repo resources are now intentionally minimal:

- locale-aware structural cues
- bounded reusable matching hints
- safe fallback defaults for a profile when no tenant-derived hints have been persisted yet
- minimal heading/axis anchors for profile-level semantics that must bootstrap the first extractable pass

They are no longer the long-term storage for tenant semantics.
Tenant-derived extraction hints now live in persistence and are resolved at runtime as:

- minimal platform defaults from repo
- plus persisted tenant-derived hints by:
  - tenant
  - profile
  - locale
  - document provenance

The runtime ownership model is now explicit:

- platform defaults:
  - fallback-only
  - repo-owned
  - intentionally smaller than the effective runtime config
- tenant-derived hints:
  - persisted outside repo
  - derived internally from approved uploaded documents
  - used as real runtime extraction input
- extracted knowledge:
  - persisted source of truth for operator visibility and downstream retrieval/response use

The effective config resolution remains backend-owned and traceable, with source metadata indicating whether a signal comes from:

- `platform_default`
- `tenant_derived`
- `mixed`

### System-Owned Bootstrap Assistance

Uploaded documents are treated as approved tenant knowledge immediately.
The platform does not require users to author technical extraction rules.

Instead, ingestion now derives bounded internal bootstrap hints from extracted claims and chunk support summaries, including:

- active extraction profiles
- observed sections
- observed axes
- observed values by axis
- section aliases by axis when they are useful for later extraction passes
- support-class counts

These hints remain:

- internal
- explainable
- refreshable on re-ingest
- non-authoritative compared with the source document itself

Persisted bootstrap/extraction hints are now tenant-scoped runtime data, not repo state.
This means operators only upload approved documents; the platform derives and persists bounded hints internally without asking users to author regexes or low-level extraction config.

The ingest path now uses those hints in a bounded bootstrap loop:

- first extraction pass with currently effective persisted hints
- hint derivation from the approved uploaded document
- second extraction pass with merged runtime hints

This keeps the adaptation explainable and document-grounded while allowing tenant-derived section aliases to influence extraction without moving tenant phrasing into repo defaults or TS constants.

### Retrieval Owns

- lexical retrieval compatibility over `searchText`
- structural retrieval projections built from:
  - topic
  - supported axes
  - unspecified axes
  - normalized extracted values
  - section signals
- claim-backed neutral summaries derived from structured payloads

Retrieval summaries are now structural, not customer-facing prose. Their purpose is:

- ranking support
- approved context shaping
- deterministic fallback support when needed

They are not the final user-facing answer.

### Knowledge Visibility Model

The platform now exposes a grounded operator-facing view of what the system currently knows from uploaded documentation.

This view is built from:

- persisted structured claims
- persisted entities
- support summaries
- provenance metadata
- persisted extraction-profile usage
- persisted tenant-derived extraction hints resolved into the effective profile config

It does not rely on:

- raw chunk dumps as the primary operator surface
- free-form AI summaries disconnected from extracted evidence
- hidden runtime-learned chat patterns
- repo JSON resources as the source of truth for tenant knowledge

The visibility model can show:

- extracted axes and values
- support class:
  - explicit
  - partial
  - bounded inference
- unspecified axes
- provenance by:
  - document
  - section
  - page or sheet
  - chunk sequence
- active extraction profile
- whether tenant-derived hints are currently applied
- which active documents contributed those derived hints

Grounded summary lines for operators are composed only from extracted structured data and provenance-backed claims.

### Knowledge View Refresh Lifecycle

The knowledge visibility view reflects the current active document corpus and refreshes when documentation changes through normal document operations:

- upload + ingest
- re-ingest
- activate
- archive
- replace source content and ingest again

The backend recomputes the view from current persisted chunk/knowledge-item state, so operators do not need to manually approve documents again or re-author extraction rules.

### Loss-Minimizing Intermediate Knowledge Layer

The current structured-claim path is not enough on its own because some document relations are structurally valid but not yet safely representable as final typed claims.

The platform therefore needs a loss-minimizing intermediate layer between:

- raw chunk text
- typed claims

That intermediate layer is normalized propositions.

Its purpose is:

- preserve relations the current claim model cannot yet type cleanly
- reduce information loss when extraction encounters a reusable but not-yet-promoted relation
- let retrieval and response operate on stronger evidence than raw excerpts alone
- separate true document absence from extraction uncertainty

This layer must be implemented with these rules:

- unknown relations are not discarded
- typed claims remain the highest-confidence structured surface
- propositions are reusable normalized relation candidates, not customer-facing summaries
- excerpts remain the lowest evidence tier
- promotion from proposition to claim happens only when a structural relation class recurs enough to justify a reusable axis/facet/scope model

Runtime precedence must become:

1. typed claims
2. normalized propositions
3. excerpt-only evidence

This is especially important for absence phrasing.

The platform must not say a detail is "not specified" only because no typed claim exists.
That wording is valid only when:

- typed claims do not support the detail
- propositions do not support the detail
- excerpt retrieval does not support the detail
- extraction confidence is high enough that absence is meaningful

Otherwise the runtime must treat the case as extraction uncertainty, not document absence.

The concrete repo-aligned design for this layer lives in:

- [loss-minimizing-knowledge-layer.md](./loss-minimizing-knowledge-layer.md)

### Path Portability

Runtime code and tests must remain portable across:

- local development
- Docker
- CI
- alternate workstation paths

That means:

- no absolute machine-local filesystem paths in runtime code
- no absolute machine-local filesystem paths in tests
- resource resolution through project-relative roots, `__dirname`, or equivalent portable path handling

Repo resources remain bootstrap inputs only; persisted tenant hints and persisted extracted knowledge remain the runtime source of truth.

### Response / Presentation Owns

- final customer-facing voice
- source-oblivious phrasing
- company-direct tone
- governed transformation of structural approved context into user-facing prose

This keeps the architecture aligned with the rule:

- extraction is not presentation
- retrieval is not presentation
- AI response generation plus governed fallback/presentation layers own the final wording

## Grounding Ownership After Structured-Claim Cleanup

`ResponseGroundingService` no longer treats tenant/domain value lists such as exact materials as decisive core truth.

Instead it now prefers:

- structured axis support from retrieved document matches
- unspecified axes from retrieved document matches
- dynamic evidence terms derived from extracted document values
- generic request/evidence terms for non-structured axes

This keeps core grounding reusable while still allowing document-derived tenant facts to participate safely when they are actually present in approved context.

## Response Voice Ownership After Cleanup

Direct company voice is still required for customer-facing answers, but its ownership is now narrower:

- extraction does not write customer-facing phrasing
- retrieval does not persist customer-facing phrasing
- approved response context no longer owns broad verb-rewrite logic
- governed response prompt + contract remain the primary voice strategy
- a small explicit presentation helper may normalize:
  - source lead-ins such as `El documento indica...`
  - leading third-person company narration when needed for deterministic fallback quality

This keeps response voice behavior:

- source-oblivious
- customer-friendly
- bounded
- testable

without making extraction or grounding responsible for writing the answer.

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
  - real tenant capability activation resolved through managed `tenant_capabilities` config with compatibility fallback
  - real product catalog lookup through a tenant-neutral catalog source boundary
  - active catalog source adapters for:
    - uploaded structured inputs
    - REST-backed product sources
  - explicit tenant resource adapters for:
    - text / markdown / html uploads
    - PDF uploads
    - DOCX uploads
    - XLSX uploads
    - URL-backed document ingestion
    - structured catalog uploads
  - short follow-up knowledge/advisory turns preserve recent topic through backend continuity and structured retrieval carryover instead of relying only on lexical overlap in the latest message
  - grounded summaries are synthesized into concise backend-safe summaries before reaching the response layer
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
- Filesystem prompt files remain the recommended bootstrap/editorial baseline for each prompt key and are used as the backend fallback when no managed prompt version is active
- Prompt retrieval is already wired into the live AI gateway path for both interpretation and response generation
- The effective system prompt is now assembled from three explicit layers:
  - fixed safety layer
  - governed editorial policy layer
  - backend-owned contract layer
- Admin prompt operations must expose those layers separately so operators can distinguish:
  - active managed wording
  - current recommended baseline
  - fixed backend contract/safety behavior
- Provider/runtime failures such as rate limits degrade through backend fallback; they must not require operators to infer runtime safety from prompt text alone
- Core prompt/policy defaults must remain tenant-neutral:
  - they may preserve raw user signals and backend-owned structural contracts
  - they must not embed tenant/domain overlays such as price-band shortcuts, room taxonomies, or business-specific attribute mappings
  - if those overlays are ever needed, they must live behind tenant capability boundaries rather than the core prompt base

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
  - Wave 8.1, `Async Turn Intake, Cancellation, And Presence Foundation`, is closed
  - Wave 8.2, `User Chat Product UI`, is now the next delivery phase and remains gated on the async foundation already landed in Wave 8.1
- The gateway-specific prerequisite is now absorbed:
  - provider registration/resolution no longer lives inline in `AiGatewayService`
  - prompt/protocol assembly no longer lives inline in `AiGatewayService`
- A later prompt-governance prioritization remains explicit:
  - structural response/interpretation protocol contracts, output field names, enum values, and JSON-shape guarantees must remain backend-owned rather than freely admin-editable
  - policy/editorial prompt instructions can later become governed/admin-editable behind managed resources
  - `AiPromptAssemblyService` is now the correct boundary for that future split, but the split itself is not a blocker for Wave 8.1
  - code-owned fallback protocol behavior must continue to exist even if governed prompt policy becomes editable later
- The legacy-backed async prerequisite before public chat rollout is now absorbed into the backend:
  - async intake accepts and coalesces inbound messages before semantic-turn closure
  - pending reply projection can be superseded by newer inbound input
  - explicit queued / processing / awaiting-reply / completed session state is now available for future user-chat presence UX
- Carried technical debt remains explicit before full public-chat rollout:
  - `AsyncTurnTimingPolicyService` still uses inline heuristics for stabilization and reply-delay timing
  - supersession currently invalidates stale reply projection, but it does not yet abort an already-running model/tool call once processing has started
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
  - closed on this branch
  - adds persisted semantic-turn intake, coalescing, additive async acceptance/session-sync contracts, delayed reply projection, and supersession of pending replies before public chat delivery
  - preserves the canonical backend pipeline after semantic-turn closure:
    `input -> interpretation -> parsing -> decision -> execution -> response -> logging`
  - carries explicit non-blocking debt:
    - inline timing heuristics remain in `AsyncTurnTimingPolicyService`
    - supersession prevents stale reply emission but does not yet abort already-running model/tool work
  - must not expand the still-carried prompt-governance debt in `AiPromptAssemblyService`; structural protocol contract remains backend-owned while editable policy wording stays a later prioritization item
- Wave 8.2: User Chat Product UI
  - depends on Waves 1 through 7 plus Wave 8.1
  - is now closed on this branch
  - replicates the DreamsChat public layout as the production-facing user chat shell while running on top of the stabilized async backend intake foundation instead of the synchronous `/chat/message` shell
  - consumes the additive async contracts for:
    - immediate acceptance
    - queued / processing / awaiting-reply visibility
    - session sync and transcript recovery
    - stale reply suppression through backend supersession truth
  - keeps the public chat client presentation-only:
    - no client-side decisioning
    - no client-side tool routing
    - no tenant shortcuts
  - carries explicit non-blocking debt into Wave 9:
    - inline timing heuristics remain concentrated in `AsyncTurnTimingPolicyService`
    - supersession suppresses obsolete replies but does not yet abort model/tool work already in flight
    - frontend validation remains build-only because the workspace still lacks a supported UI test harness
- Wave 8.3: Core Stabilization, Real AI Configuration, And Exploratory Readiness
  - is now fully closed on this branch and leaves the platform ready for real exploratory core testing before centralized hardening begins
  - stabilizes async intake for exploratory use by moving timing policy behind governed `async_intake` config and propagating cancellation/abort through semantic execution, AI runtime, and tool execution paths
  - hardens exploratory startup/runtime operability by:
    - aligning bootstrap/default AI runtime resolution with real `OPENAI_API_KEY` exploratory use
    - making env loading explicit at backend startup so governed runtime credentials resolve reliably in the live process
    - surfacing AI runtime truth in diagnostics and `/health/ready` instead of only reporting infrastructure/table readiness
  - absorbs the remaining core blockers discovered during live closure:
    - critical-config bootstrap seeding now tolerates concurrent startup races
    - tenant-scoped async/core repository updates no longer depend on Prisma `update`/`findUniqueOrThrow` patterns that conflict with hardened tenant policy
  - keeps the governed response/prompt architecture final-form:
    - backend-owned protocol/output contracts stay fixed in code
    - managed prompt resources remain editable editorial/policy layers only
    - code fallback exists only for missing editorial policy layers
  - reduces critical exploratory admin friction by keeping structured operators paths for `ai_runtime` and response fallback resources while preserving governed lifecycle rules
  - has been validated with a live OpenAI-backed async public-chat smoke:
    - diagnostics `ready`
    - readiness `ready`
    - public async turn acceptance, presence transitions, reply projection, and multi-turn follow-up completed on the real runtime without response fallback

### Wave 9: Centralized QA, Security, Roles, E2E, And Production Hardening

1. Wave name: Centralized QA, Security, Roles, E2E, And Production Hardening
2. Strategic objective: centralize regression and QA strategy, finalize authentication and role separation, guard admin access, and harden rollout across the now-complete backend and UI surfaces.
3. Why it happens now: centralized QA, security, roles, and E2E hardening are most effective after both admin and user product surfaces are real and stable enough to validate end-to-end behavior instead of placeholders, and after Wave 8.3 has confirmed real exploratory readiness of the governed AI runtime path through live OpenAI-backed smoke.
4. Dependency on previous waves: depends on Waves 1 through 8, including stable runtime, admin tooling, knowledge/test-center UI, and user-facing chat product flows.
5. Main implementation scope: centralize QA strategy and regression execution; implement auth and role boundaries; guard admin routes and managed-resource mutations; add Playwright/E2E regression for admin and user flows; finalize multitenant smoke coverage; harden rollout, observability, and tenant onboarding/operational readiness.
6. Architecture constraints: security remains backend-enforced; automatic tenant isolation cannot be weakened by client context; centralized QA suites must assert canonical backend truth rather than UI-only heuristics; hardening must not collapse stage separation or reintroduce manual routing shortcuts.
7. Legacy contributions that should be mined: legacy Playwright/E2E journeys, multitenant smoke tests, operator QA flows, and other rollout-oriented assets identified in the legacy audit, always rewritten against the new platform contracts rather than copied as-is.
8. Expected user/platform value: the platform becomes ready for controlled rollout with authenticated admin operations, tenant-safe user access, and centralized regression suites that protect the full product surface.
9. Completion criteria: centralized QA strategy is active; auth and role separation are active; admin surfaces are guarded; Playwright/E2E suites cover critical admin and user journeys; multitenant regression and operational hardening are in place for production rollout.
10. Explicit next-wave enablement: enables controlled tenant onboarding, rollout scaling, and ongoing delivery without revisiting the core platform architecture.

## Post-Wave 8.3 Conversational Stabilization

After Wave 8.3 closed exploratory runtime readiness, the branch absorbed one narrow stabilization pass focused on reliable appointment scheduling and conversational naturalness without opening Wave 9.

- Interpretation remains AI-only, but the backend-owned contract now requires a provider-compatible structured entity schema and explicit preservation of `entities.rawMessage`, so parser/continuity never lose the original user booking signal when the model omits detail.
- Parsing and continuity remain backend-owned:
  - booking continuity keeps the booking lane active while real backend booking fields are still unresolved
  - fragmented booking turns can carry a safe request summary forward into tool execution instead of degrading to date-only notes
  - unsupported booking asks such as generic appointment type or visit objective are not part of the backend booking contract and therefore must not survive decision/response clarification in the stabilized path
- Response naturalness remains governed:
  - deterministic fallback/basic clarification wording is still backend-approved
  - locale-aware managed response-fallback catalogs now support optional `templateVariants`
  - variant selection is deterministic and observable from backend seeds rather than inline phrase arrays inside response services

This stabilization pass was validated against the real OpenAI runtime on the live async public chat path:

- a direct realistic booking message completed successfully without a generic clarification loop
- three rapid fragmented booking messages coalesced into one semantic turn and completed as a confirmed booking

That leaves the platform ready for real exploratory booking tests while keeping Wave 9 as the next broader hardening step.

## Post-Wave 8.3 Document Knowledge Operations And Booking Completion

After the exploratory-runtime closeout, the branch absorbed one focused product-capability phase to make document-grounded conversation and booking completion work together without opening Wave 9.

- A governed document domain now exists as a distinct backend-owned resource family:
  - admin-managed `DocumentRecord` entries own uploaded/text source material, lifecycle, and ingestion state
  - ingested `DocumentChunk` entries form the active document-origin conversational corpus
  - operator flows for create/upload/list/detail/ingest/activate/archive run through the admin UI on the existing exact DreamsChat shell rather than filesystem or developer-only shortcuts
- Knowledge is now explicitly separated into three classes:
  - document-origin knowledge:
    - admin-managed
    - ingested/chunked
    - the active retrieval corpus for document-grounded conversation
  - runtime-learned knowledge:
    - extracted asynchronously from persisted logs for observability and future analysis
    - not the primary conversational retrieval source for document questions
  - backend transactional truth:
    - execution and state facts such as confirmed bookings
    - remains separate from both document and learned corpora
- A future product-catalog source is now an explicit roadmap requirement:
  - the current demo `get_product` path is only a temporary placeholder for exploratory flows
  - the platform will need a dedicated backend-owned catalog boundary that can connect to a real product catalog
  - that catalog source must remain distinct from:
    - document-origin knowledge
    - runtime-learned knowledge
    - backend transactional execution truth
  - document continuity/retrieval fixes must not solve future catalog needs by expanding demo-catalog assumptions into the document corpus or response layer
- Retrieval source selection remains backend-owned:
  - semantic-turn execution decides whether document retrieval is relevant for the turn
  - retrieval runs over the document-origin corpus only
  - retrieval eligibility is no longer limited to explicit phrases like `what does the document say`; eligible knowledge/advisory turns can consult approved tenant-scoped knowledge through structured backend signals and active continuity state
  - approved document context is injected into the response layer as backend truth; the model may word the answer, but it does not choose the corpus or invent unsupported document facts
- Combined document + booking flows remain aligned with stage separation:
  - document grounding enriches approved response context
  - booking still runs through backend decision and tool execution truth
  - the final response may synthesize over both approved document context and confirmed booking truth without letting the model decide actions or fabricate requirements
- Near-term continuity work remains focused on preserving document-grounded and advisory multi-turn coherence; future real catalog connectivity should layer in as its own backend source once that continuity work is stable.

This leaves the platform ready for real exploratory testing of both document-grounded QA and booking completion, while keeping Wave 9 as the next centralized hardening step rather than reopening the core runtime architecture.

## Post-Document Conversational Structural Fix

After the document + booking product phase, the branch absorbed one narrow structural conversational pass to fix failures discovered in real exploratory follow-up turns without broadening into Wave 9 hardening.

- Continuity now distinguishes exploratory conversation modes explicitly and backend-owned:
  - `document_exploration`
    - active when the conversation is grounded in uploaded document knowledge
    - preserves approved document references, last topic, and grounded retrieval summary compactly
  - `advisory_exploration`
    - active when the conversation is in a generic multi-turn recommendation or comparison flow
    - preserves an open advisory goal, accumulated approved signals, and useful topical continuity without hardcoding a room/preference taxonomy
- Retrieval is no longer only a post-decision sidecar for conversational document use:
  - semantic-turn execution now computes document retrieval preview before decisioning
  - backend decisioning can use that preview plus active continuity state to decide whether the turn should stay in document-grounded exploration, stay in advisory exploration, invoke a transactional tool, clarify, or simply respond
  - this preserves backend-owned routing while avoiding example-driven hacks around one or two literal phrases
- Routing precedence is now explicit:
  - booking still wins when backend booking requirements are satisfied or minimally clarifiable
  - document-grounded exploratory turns win over demo `get_product` lookup when active approved document context is still relevant
  - advisory exploration can stay active across coherent follow-up turns instead of collapsing into generic base prompts
  - transactional `get_product` only fires when there is an actually grounded catalog match
- The demo product boundary is now honest:
  - `get_product` resolves through a dedicated catalog service instead of inline fallback matching
  - unmatched or weakly matched queries fail closed with a backend-visible no-match result
  - better wording no longer hides a routing/product mismatch
- This work preserves the already-good strengths of the platform:
  - document-grounded answers still synthesize over approved retrieved context
  - booking remains backend-truth driven and non-regressed
  - combined document + booking flows still operate on separate truth layers:
    - document-origin knowledge
    - backend transactional execution truth
    - optional continuity state

This leaves the platform structurally safer for multi-turn document and advisory exploration while still keeping Wave 9 as the next broader QA/security/E2E hardening step.

## Post-Continuity Lexical Heuristic Cleanup

After the document/advisory continuity fix, the branch absorbed one narrow structural cleanup aimed at a specific debt class: inline lexical heuristics embedded directly in decisive backend services.

- A dedicated backend-owned signal boundary now owns lexical and routing-support signals:
  - `conversation-signals` centralizes locale-aware document and advisory signal catalogs
  - a resolver turns those catalogs into structured support signals rather than leaving raw regex arrays inside `decision`, `document retrieval`, or `continuity`
  - lexical cues remain allowed, but only as maintainable inputs with clear ownership, tests, and locale scope
- Core routing services no longer own inline cue arrays:
  - `DecisionService` consumes structured advisory/document support signals plus continuity state, approved retrieval presence, and product-match grounding
  - `DocumentRetrievalService` uses the same signal boundary to decide whether document retrieval is explicitly requested or is continuing an active document exploration turn
  - `ConversationContinuityService` uses the shared signal boundary when deciding whether advisory exploration should remain active
- Routing remains backend-owned and explicit:
  - document-grounded exploration
  - advisory exploration
  - transactional product lookup
  - booking
  - combined document + booking
  still remain distinct modes, but the supporting lexical layer is now structured instead of ad hoc
- This cleanup preserves future product-catalog evolution:
  - the current `get_product` path remains a bounded demo-catalog adapter
  - the new signal boundary does not deepen assumptions about that demo catalog
  - future real catalog integration can plug in behind its own backend source-of-truth boundary without reopening document/advisory routing ownership
- Combined document + booking response shaping is now tighter:
  - approved response context exposes a response-safe document view with a `combined_execution` mode
  - combined flows pass summarized document grounding instead of excerpt-heavy raw context to the AI response layer
  - fallback and AI guidance both bias toward concise grounded synthesis plus execution truth rather than literal document dumping

This leaves the platform with clearer multilingual maintainability and less brittle routing growth while still preserving the current high-quality document-grounded conversational behavior.

## Core/Tenant Planning Note

The next conversational implementation stage must follow the explicit planning split documented in [core-tenant-corpus-implementation-plan.md](/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/docs/core-tenant-corpus-implementation-plan.md).

- Core platform includes:
  - conversational substrate
  - continuity
  - grounding
  - contextual closure
  - document-processing capability
- Tenant capability modules include:
  - booking
  - quote
  - structured measurements
  - product-catalog lookup
  - support/post-sale
- Tenant resources include:
  - uploaded documents
  - catalogs
  - pricing
  - policies
  - business metadata

Document processing remains a core capability, while uploaded document content remains tenant-scoped approved knowledge. The real-message corpus and legacy assets remain planning inputs for pattern extraction and regression design only; they must not become active conversational knowledge or a shortcut for hardcoding tenant wording into the core runtime.

The current corpus-distillation artifacts for this branch live in:

- [corpus-distillation-report.md](/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/docs/corpus-distillation-report.md)
- `/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/test/fixtures/real-corpus/runtime-general`
- `/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/test/corpus-derived`

These artifacts exist to keep the boundary executable:

- reusable conversational mechanics can be promoted into core with explicit evidence
- tenant capability behavior patterns remain outside the shared runtime even when frequent in one tenant corpus
- the real corpus stays as regression input, never active runtime knowledge

The current runtime improvements derived from those artifacts are intentionally core-only:

- contextual close-turn remains backend-owned and state-aware
- short follow-ups and re-engagement now reuse prior conversational state instead of reopening generic intake
- explicit thread switching invalidates stale thread facts without depending on tenant-specific business taxonomies
- document retrieval and routing now consume structured signal support from the dedicated conversation-signal boundary instead of growing inline token lists in decisive services

The latest correction pass tightened those same core mechanics without reopening tenant-specific routing:

- continuity now preserves a stable subject summary separately from narrower topic text so short follow-ups can inherit the active subject before a lane is fully locked
- bridge wording can keep an established subject active without becoming a hard topic-switch signal
- document retrieval composes incremental follow-up facets over the active subject instead of depending only on lexical overlap with the newest short turn
- approved response context can mark weak knowledge turns as backend-locked so the response layer stays inside approved grounded behavior instead of filling gaps with generic domain knowledge
- short informational follow-ups now bias toward concise incremental answers rather than excerpt-heavy restatements

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

Wave 8.1 adds additive async observability around that canonical pipeline for future user-chat delivery:

- `async_intake`
- `async_turn`
- `reply_projection`

These stages wrap semantic-turn acceptance, coalescing, supersession, delayed reply projection, and presence-facing session state without changing the canonical execution pipeline that runs only after semantic-turn closure.

Typing/presence is now also a backend-owned finalization signal inside the async intake boundary:

- the public client can report active composition for an existing async conversation
- the backend can extend the active stabilization window while the user is still typing
- semantic-turn closure waits for the typing quiet period instead of treating presence as decorative UI only
- reply projection can also be re-held when the user resumes typing after processing completed but before the assistant reply is emitted
- the public chat client sends an immediate typing signal on composition start so the backend pause is not delayed by heartbeat debounce alone
- `/chat/message` remains unchanged; this behavior is additive to the async public-chat contracts

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

Response grounding now distinguishes three backend-owned support modes for document/advisory turns:

- explicit supported fact
- partial support that allows bounded synthesis but still requires unspecified-detail disclosure when exact data is absent
- unavailable support, which must stay honest and concise instead of inventing coverage, pricing, materials, or purchase facts or exposing internal retrieval mechanics to the user

Response grounding and response fallback ownership are now also split more cleanly:

- `ResponseGroundingService` owns contextual support assessment and bounded document-overreach detection through a dedicated grounding boundary instead of inline stopword-heavy heuristics inside `ResponseGuardrailService`
- `ResponseFallbackService` still resolves managed runtime catalogs as the primary source of deterministic wording, but compatibility-safe bootstrap copy now lives in a dedicated response-fallback bootstrap boundary instead of inline multilingual maps inside the runtime service
- governed fallback wording for unavailable approved knowledge is expressed in natural product language rather than backend retrieval terminology, while source selection remains fully backend-owned

Contextual `close_turn` is also now backend-owned and state-aware:

- it depends on prior approved flow completion, missing-field state, and fresh-request signals
- it is not triggered by gratitude keywords alone
- the response layer may acknowledge closure briefly, but guardrails reject close-turn outputs that reopen the conversation with a fresh help prompt

The `learning` stage persists:

- source log id and source stage
- governed policy/config versions used for extraction
- completed, skipped, or failed async learning outcomes
- stored knowledge identifiers and embedding references when extraction succeeds

## Tenant Capability Runtime Boundary

The runtime now exposes a dedicated tenant capability boundary under:

- `/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/tenant-capabilities`

Current shape:

- `TenantCapabilityRegistryService` is the runtime entrypoint used by decisioning
- a static resolver currently enables the existing single-tenant capabilities by default
- decisioning now asks capability boundaries whether business workflows are enabled instead of hardcoding those assumptions directly into the core service

This keeps the current branch compatible with the existing single-tenant runtime while moving toward a SaaS-compatible shape where:

- core runtime remains tenant-neutral
- business workflows stay modular
- future per-tenant capability enablement can evolve without rewriting the conversational substrate

## Tenant Resource Boundary

The runtime now exposes an explicit tenant resource boundary under:

- `/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/tenant-resources/tenant-resource.types.ts`

This boundary makes explicit that:

- documents
- catalogs
- pricing
- payment terms
- hours
- references
- policies
- other business metadata

remain approved tenant-scoped resources rather than core logic. The chat may consume them only through approved backend-governed boundaries.

## Runtime Tenant Resolution For Governed Resources

Governed runtime resources such as:

- prompts
- temporal locale resources
- critical configs
- response fallback catalogs
- knowledge metadata

are tenant-scoped resources. The active runtime truth for those resources must therefore resolve from the backend tenant context, not from a separate frontend-only default.

Current shape:

- backend request handling resolves tenant context from `x-tenant-id` when explicitly provided or `DEFAULT_TENANT_ID` otherwise
- runtime-managed resource repositories now scope version history, active lookups, and activation/archive operations explicitly to the resolved tenant
- admin prompt/runtime-resource surfaces expose the effective runtime tenant context so operators can see which tenant they are governing

This keeps the platform multi-tenant-safe while also making local/single-tenant exploratory operation unambiguous:

- `demo-tenant` is the current backend default runtime tenant in local exploratory mode
- historical rows under other tenants (for example `tenant-alpha`) do not become the active runtime truth unless a request explicitly resolves into that tenant

## Legacy Coexistence Boundary

The legacy application and `/ai-platform` may coexist during migration, but they must not act as peer chat runtimes.

Target shape:

- legacy remains temporary:
  - channel connector host
  - operator shell for still-unmigrated controls
- `/ai-platform` becomes the only owner of:
  - conversational runtime
  - response generation
  - document grounding
  - suggestion lifecycle
  - learning / approved-chat knowledge ingestion
  - debug truth

Important constraints:

- legacy must integrate through a dedicated bridge boundary, not through deep admin endpoints and not through direct DB writes
- same PostgreSQL infrastructure is allowed, but same PostgreSQL schema is not
- if both apps share one database instance, they must use separate schemas because both Prisma apps define overlapping runtime tables and migrations

Recommended split:

- legacy schema: `public`
- standalone schema: `ai_platform`
- optional future bridge schema: `integration_bridge`

The bridge must remain an anti-corruption layer that:

- authenticates legacy-origin sync traffic
- enforces idempotency and version ordering
- translates legacy payloads into standalone-native modules
- prevents legacy contracts from leaking into runtime decisioning, retrieval, or response composition

## Loss-Minimizing Knowledge Layer

The document runtime now has four distinct evidence tiers:

1. raw corpus and chunks
2. normalized propositions
3. typed claims
4. response synthesis over the strongest available tier

This is an explicit architectural boundary, not a temporary heuristic.

Current runtime shape:

- extraction may emit both:
  - `DocumentKnowledgeItem`
  - `DocumentKnowledgeProposition`
- retrieval resolves evidence in this order:
  - typed claims
  - normalized propositions
  - excerpt-only support
- response grounding records:
  - `evidenceTier`
  - `absenceReason`

This is important because `not specified` is no longer allowed to mean "the extractor did not find it".

The runtime must distinguish:

- `document_gap`
  - the document genuinely does not provide structured support for the requested detail
- `extraction_uncertain`
  - the corpus contains relevant evidence, but only at proposition or excerpt level, or the current extractor/model cannot promote it safely yet

Unknown relation classes must therefore degrade to propositions or excerpts, not disappear.

### Promotion Boundary

Promotion from proposition to typed claim is now a separate bounded workflow:

- persisted propositions carry:
  - `patternKey`
  - `promotionState`
  - optional promoted target axis/facet
- admin/runtime analysis can list promotion candidates grouped by `patternKey`
- promotion must remain:
  - reusable
  - profile-aware
  - non-tenant-hardcoded

This keeps the system from solving repeated relation classes with ad-hoc wording fixes or per-document extraction rules.

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

## Channel Control Boundary

`ChannelControl` is now an explicit bounded context inside `ai-platform` with two distinct planes:

- desired state
  - versioned config in managed critical config key `channel_control`
- observed state
  - latest runtime projection in `ChannelConnectionState`

This split is intentional:

- desired state is edited by admin/UI workflows
- observed state is published by transport adapters
- neither concern is allowed to leak into core chat decisioning

Internal adapter contracts are read/write only for control-plane integration:

- `GET /internal/channel-control`
- `GET /internal/channel-control/channels/:channelKey`
- `PUT /internal/channel-control/channels/:channelKey/connection-state`

These contracts exist so transport adapters can stop reading legacy backend config without coupling core chat runtime to adapter-specific orchestration.

## Channel Conversation Bridge

Transport adapters must not depend on legacy conversation endpoints anymore.

`ai-platform` now exposes an internal bridge boundary for transport-originated conversation traffic:

- `POST /internal/conversations/inbound`
- `POST /internal/conversations/history-message`
- `POST /internal/conversations/bootstrap-thread`
- `POST /internal/conversations/outbound-status`
- `POST /internal/conversations/:id/agent-turn`
- `POST /internal/conversations/:id/replies/agent`

This bridge is intentionally additive:

- it does not replace the core async chat runtime
- it maps transport identities into platform-native `conversationId`
- it persists channel-side correlation separately through:
  - `ChannelConversationBinding`
  - `ChannelMessageRecord`

That keeps adapter concerns outside the core response/decision pipeline while still letting channel transports stop depending on legacy backend ownership.

## Channel Settings API

The UI-facing channel settings API is standardized under `ai-platform`.

Channel settings screens use:

- `GET /settings/channels/meta`
- `PUT /settings/channels/meta`
- `POST /settings/channels/meta/sync`
- `GET /settings/channels/whatsapp-qr`
- `PUT /settings/channels/whatsapp-qr`
- `POST /settings/channels/whatsapp-qr/session/start`
- `POST /settings/channels/whatsapp-qr/session/stop`
- `POST /settings/channels/whatsapp-qr/session/reconnect`
- `POST /settings/channels/whatsapp-qr/session/reset`
- `POST /settings/channels/whatsapp-qr/sync`
- `POST /settings/channels/whatsapp-qr/backfill`
- `GET /settings/channels/email`
- `PUT /settings/channels/email`

This API is separate from the lower-level control contracts:

- `/admin/channel-control` exposes raw desired state for admin/control-plane tooling
- `/internal/channel-control` exposes adapter-facing snapshots and connection-state writes
- `/settings/channels/*` exposes screen-ready channel settings and channel operations

The underlying owner remains the `ChannelControl` bounded context. Channel operations that need transport state delegate to `channel-adapter` through an explicit adapter admin client.

Channel settings UI can live in ecommerce/admin-facing applications as a consumer surface. That does not move ownership out of `ai-platform`: ecommerce can present and operate chat capabilities, but it must read/write channel state through the chat platform contracts.

Secrets are not stored directly inside the versioned `channel_control` resource. Channel credential fields use refs:

- `local` refs resolve through the local/dev `ChannelSecret` store
- `env` refs resolve through environment variables
- production secret management should replace the local/dev store behind the same ref boundary

Email has an explicit boundary:

- inbox email transport config belongs to `ChannelControl`
- ecommerce delivery config, templates, role rules, categories, logs, metrics, and transactional test-send do not belong to `ChannelControl`
- those delivery concerns must stay in the ecommerce/notifications domain until they are extracted into a separate delivery-control module
- legacy `/settings/email/inbox-config` is not recreated in `ai-platform`; callers must use `/settings/channels/email`

## Storefront Chat Integration Boundary

Storefront chat consumers must not call legacy `/conversations/webchat/*`.

`ai-platform` now exposes a dedicated public facade for storefront webchat:

- `POST /chat/public/webchat/session`
- `GET /chat/public/webchat/session/:conversationId`
- `POST /chat/public/webchat/messages`

This facade is an adapter over the async chat runtime, not a second chat implementation. It preserves ecommerce UI isolation while keeping the chat core inside `ai-platform`.

## Frontend Theme Strategy

- The standalone frontend owns copied DreamsChat assets locally inside `frontend/public`
- Admin operations UI uses the DreamsChat admin dashboard shell and native asset pack as a first-class in-project dependency
- Public chat visuals are also vendored now and the public user-chat product shell is live on that exact asset pack
- The source-of-truth visual template for both admin and public chat UI is `/Users/rodrigo/Personal/Proyectos/react projects/dreamschat-v2.8.4`
- Future UI waves must replicate that template layout exactly and swap in the new platform capabilities behind it, rather than building a merely similar variant
- Wave 8.2 now fulfills the public chat product requirement on top of the async intake foundation instead of the synchronous shell
- Legacy user-chat behaviors around human-like wait, pending-turn cancellation, and typing/awaiting-reply were mined into the async foundation and public chat product work, while remaining hardening debt stays explicit for Wave 9
