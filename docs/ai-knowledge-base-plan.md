# AI Knowledge Base Plan

## Objective

Define a durable and auditable knowledge pipeline for the AI layer without coupling the agent directly to raw database access or uncontrolled user content.

The knowledge system must support:

- customer-facing assistance
- internal admin assistance
- future retrieval-augmented generation (RAG)
- tenant isolation
- operator traceability

## Knowledge Source Hierarchy

Knowledge must not be treated as a flat pool. Sources have different trust levels.

Priority order:

1. Product and business-rule documentation
2. Validated backend data
3. Curated admin-authored operational knowledge
4. Derived patterns from inbound/outbound conversations
5. General model knowledge only when not conflicting with the sources above

## Initial Knowledge Sources

### 1. Structured documentation

Canonical sources:

- product and functional documentation
- architecture and technical decisions
- business rules and operating procedures
- pricing, quoting, fulfillment and support policies

Recommended storage:

- versioned markdown under `docs/`
- later projected into structured `KnowledgeDocument` records

Use cases:

- system behavior explanations
- business rule clarification
- internal procedural guidance
- operator-facing AI answers in `admin_internal`

### 2. Application data

Initial high-value datasets:

- products
- categories
- configurable product metadata
- customers
- orders / quotes summary references where appropriate

Rules:

- agent never reads PostgreSQL directly
- backend compiles safe knowledge views or retrieval endpoints
- customer-facing AI must only access customer-safe fields
- admin-facing AI may access richer operational fields through backend authorization

Use cases:

- product lookup
- pricing context
- customer assistance
- admin operational actions

### 3. Manual admin knowledge

This is a key source and should be explicit, not accidental.

Entry path:

- admin internal chat with AI
- future dedicated knowledge UI

Types of admin-authored knowledge:

- reusable FAQs
- exception handling rules
- channel playbooks
- escalation criteria
- commercial wording
- support macros
- operational conventions not yet formalized in docs

Critical rule:

- admin chat messages should not automatically become trusted knowledge
- they must first be captured as candidate knowledge and then curated/approved

## Cross-tenant document management requirement

The system must provide a clear document-management flow for **any tenant**, not just a specific implementation such as `urucortinas`.

Minimum lifecycle:

1. upload document
2. classify by scope
3. persist metadata and file
4. allow preview/download
5. allow delete/reload
6. reindex approved content

This flow is part of the platform capability and should not be treated as a tenant-specific customization.

### 4. Conversation-derived knowledge

This source is important but high-risk if ingested naively.

Potential value:

- repeated customer questions
- objections and sales friction
- service issues
- language customers actually use
- emergent business rules that operators repeatedly apply

Risks:

- incorrect operator responses
- hallucinated AI replies
- one-off exceptions
- personal data leakage
- duplicated or contradictory knowledge

Recommendation:

- do not feed raw messages directly into trusted RAG
- first create a pipeline:
  - classify
  - redact
  - cluster
  - review
  - approve

## Proposed Data Model Direction

Phase 1 should stay simple but prepare the canonical structures:

- `KnowledgeSource`
  - origin type: `docs`, `backend_dataset`, `admin_curated`, `conversation_derived`
- `KnowledgeDocument`
  - canonical content unit
- `KnowledgeChunk`
  - retrieval unit
- `KnowledgeFact`
  - optional structured assertions later
- `KnowledgeIngestionRun`
  - ingestion traceability
- `KnowledgeCandidate`
  - unapproved content extracted from admin/chat/conversations
- `KnowledgeApproval`
  - curator decision trail

## Separation By Scope

The knowledge system must support at least:

- `customer_public`
- `admin_internal`

Rules:

- customer scope only receives approved customer-safe content
- admin scope can receive richer operational knowledge
- tenant boundaries apply to both

## Ingestion Strategy By Source

### Docs ingestion

Pipeline:

1. read whitelisted docs
2. normalize markdown
3. split into chunks
4. tag with scope + source metadata
5. persist

### Backend data ingestion

Pipeline:

1. backend exposes safe retrieval snapshots
2. AI or future ingestion worker transforms records to canonical knowledge documents
3. persist chunked representations

Examples:

- product snapshot to searchable knowledge cards
- customer-safe category summaries
- internal operational datasets for admin scope

### Admin-curated ingestion

Pipeline:

1. operator submits or marks content from admin
2. backend stores as `KnowledgeCandidate`
3. curator approves/rejects/edits
4. approved item becomes `KnowledgeDocument`

### Conversation-derived ingestion

Pipeline:

1. collect candidate messages or conversation clusters
2. redact PII
3. summarize repeated patterns
4. require human approval
5. publish as curated knowledge

## Traceability Requirements

Every knowledge unit should preserve:

- `tenantKey`
- source type
- source record id
- original document/message reference
- author or ingestion actor
- approval status
- approval actor
- timestamps
- scope visibility

This is required so the system can explain where a fact came from and revoke it safely.

## Phase Recommendation

### Phase A

- document knowledge architecture
- define Prisma models
- define ingestion contracts
- no vector DB yet required

### Phase B

- ingest docs
- ingest safe product knowledge snapshots
- expose knowledge admin UI for curated entries

### Phase C

- add candidate extraction from `admin_internal`
- add review/approval flow

### Phase D

- add conversation-derived candidate extraction
- add PII redaction and curation workflow
- add vector retrieval

## Practical Decision For Now

Immediate next implementation should focus on:

- docs as trusted curated source
- backend product knowledge snapshots
- explicit admin-curated knowledge entries

Raw customer conversation knowledge should remain deferred until:

- redaction exists
- approval workflow exists
- tenant-safe retrieval policies exist
