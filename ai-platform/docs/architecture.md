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

## Request Flow

1. API receives tenant-scoped user message.
2. Logging captures input.
3. Interpretation produces strict JSON.
4. Parsing normalizes AI-extracted entities.
5. Decision engine selects deterministic route.
6. Tool engine executes validated tenant action if needed.
7. AI gateway generates response text from approved context.
8. Logging persists stage-by-stage trace.
9. Knowledge service asynchronously extracts reusable knowledge from logs.

## Initial Interpretation Prompt

- The current interpretation prompt is code-backed through `RuntimeConfigModule`
- It is intentionally isolated so it can move to DB-backed prompt versioning later
- Current prompt rules enforce:
  - JSON-only output
  - allowed intents: `GENERAL_CONVERSATION`, `CLARIFICATION`, `GET_PRODUCT`, `CREATE_BOOKING`, `CREATE_QUOTE`
  - no decisions
  - no tool execution
  - language normalization to short codes such as `es` and `en`

## Multi-Tenant Enforcement

- Tenant id enters through HTTP middleware
- Tenant context stored in request scope / async context
- Prisma middleware injects and validates tenant filters
- Repositories are the only persistence access path
- Redis and Qdrant keys are prefixed by tenant id

## Observability

Tracked stages for every interaction:

- input
- interpretation
- parsing
- decision
- execution
- response
- logging
- learning

Each stage emits structured records with trace id, tenant id, duration, outcome, and payload summary.

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
