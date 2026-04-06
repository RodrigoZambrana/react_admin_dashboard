# Legacy To Standalone Integration Analysis

Date: 2026-04-05

## Objective

Define a safe migration path where:

- the legacy project keeps channel connectivity and channel-specific operational setup alive during transition
- the standalone `/ai-platform` becomes the only owner of:
  - conversational runtime
  - response generation
  - approved document usage
  - learning / knowledge extraction
  - suggestion handling
  - debug / trace interpretation
- both projects can coexist on the same PostgreSQL database infrastructure while remaining independent deployables

This document focuses on:

- channel configuration
- debug logic
- response enable/disable controls
- suggested responses
- knowledge ingestion from approved chats

## Executive Summary

Main conclusion:

- Do not migrate the legacy chat runtime into `/ai-platform`.
- Do migrate the legacy control-plane and operator workflows by re-expressing them behind backend-owned boundaries in `/ai-platform`.
- Do not let legacy write directly into standalone runtime tables.
- If both systems share the same database, they must not share the same PostgreSQL schema.

Critical finding:

- the legacy backend and `/ai-platform` both define top-level models such as `Conversation`, `Knowledge`, and related runtime tables
- if both Prisma clients point to the same PostgreSQL schema, table names and `_prisma_migrations` ownership will collide
- same database is viable only with schema isolation such as:
  - legacy -> `public`
  - standalone -> `ai_platform`

## Real Inventory

### Legacy Responsibilities Relevant To Migration

Legacy code currently owns or touches:

- channel-connected ingress/egress
  - `services/channel-adapter/src/channels/webchat/webchat.adapter.js`
  - `backend/src/channels/*`
  - `backend/src/conversations/conversations.service.ts`
- runtime config and response enable/disable behavior
  - `backend/src/ai/ai.service.ts`
  - `backend/src/ai/ai.controller.ts`
- debug and audit surfaces
  - `backend/src/conversations/conversations.controller.ts`
  - `backend/src/conversations/conversations.service.ts`
- suggested response feedback and candidate lifecycle
  - `backend/src/conversations/dto/conversation-ai-suggestion-feedback.dto.ts`
  - `backend/src/conversations/conversations.service.ts`
  - `backend/src/knowledge/knowledge.service.ts`
  - `backend/src/knowledge/knowledge.controller.ts`
- approved conversation ingestion and derived knowledge
  - `backend/src/knowledge/dto/ingest-conversation-knowledge.dto.ts`
  - `backend/src/knowledge/knowledge.service.ts`

### Standalone Responsibilities Already Present

`/ai-platform` already owns or partially owns:

- backend-governed chat runtime
  - `backend/src/modules/api/chat.controller.ts`
  - `backend/src/modules/api/async-chat.controller.ts`
  - `backend/src/modules/api/chat-orchestrator.service.ts`
- prompt composition and policy layers
  - `backend/src/modules/ai-gateway/ai-prompt-assembly.service.ts`
  - `backend/src/modules/ai-gateway/ai-prompt-contract.service.ts`
  - `backend/src/modules/prompt/*`
- deterministic continuity / decisioning / retrieval
  - `backend/src/modules/continuity/*`
  - `backend/src/modules/decision/*`
  - `backend/src/modules/documents/*`
- runtime-managed resources
  - prompts
  - critical configs
  - response fallbacks
  - knowledge metadata
- async learning from stored logs
  - `backend/src/modules/knowledge/learning.service.ts`

### Standalone Gaps Relative To Legacy

The standalone platform still lacks first-class equivalents for:

- channel configuration management
- a legacy-facing integration boundary for config sync
- channel-to-runtime bridge endpoints richer than plain `chat/async/messages`
- operator-facing suggested reply lifecycle
- approved-conversation bundle review / promotion flow
- legacy-compatible debug surface for operator tooling

## Non-Negotiable Architectural Rules

1. Legacy may remain a control plane temporarily, but not a chat runtime.
2. `/ai-platform` must own response logic, knowledge ingestion logic, and runtime decisioning.
3. Legacy must integrate through endpoints or a narrow bridge, not by writing directly into standalone runtime tables.
4. Shared DB means shared infrastructure, not shared schema ownership.
5. Channel adapters remain replaceable. Channel specifics must not leak into the standalone conversation core.

## Database Coexistence

### Current Collision Risk

Both projects currently define overlapping model names:

- legacy:
  - `Conversation`
  - `KnowledgeDocument`
  - `KnowledgeCandidate`
  - `KnowledgeRawEvent`
  - `KnowledgeIngestionRun`
- standalone:
  - `Conversation`
  - `Message`
  - `Knowledge`
  - `ConversationState`
  - `DocumentRecord`

This means:

- same PostgreSQL schema is not safe
- same `_prisma_migrations` table is not safe
- direct dual ownership of tables is not safe

### Recommended DB Topology

Use one PostgreSQL database instance, one logical database, and separate schemas:

- legacy schema: `public`
- standalone schema: `ai_platform`
- optional future shared schema: `integration_bridge`

Recommended Prisma setup:

- legacy `DATABASE_URL` continues to use `?schema=public`
- standalone `DATABASE_URL` uses `?schema=ai_platform`

If a shared bridge schema is needed later, it should contain only explicitly shared tables such as:

- outbound delivery jobs
- config sync checkpoints
- idempotency ledgers

It must not become an implicit dumping ground for runtime state.

## Recommended Coexistence Model

### Phase 1

Legacy remains responsible for:

- live channel connectivity
- channel credential/config UI
- channel delivery mechanics

Standalone becomes responsible for:

- interpretation
- continuity
- retrieval
- response generation
- logging
- learning
- suggestion intelligence

### Phase 2

Legacy sends normalized events/config to standalone through a dedicated integration boundary.

Legacy should stop calling its old AI runtime and instead:

- forward inbound messages to standalone
- receive/send approved outbound content
- sync config changes into standalone-managed resources

### Phase 3

Legacy UI can keep being the operator shell temporarily, but the data it shows should increasingly come from standalone-owned APIs instead of legacy-owned AI state.

## Recommended Integration Boundary

Do not have legacy call deep admin endpoints directly.

Introduce a dedicated bridge in `/ai-platform`, for example:

- `POST /integrations/legacy/channel-configs/sync`
- `POST /integrations/legacy/runtime-controls/sync`
- `POST /integrations/legacy/messages/inbound`
- `POST /integrations/legacy/messages/outbound-status`
- `POST /integrations/legacy/suggestion-feedback`
- `POST /integrations/legacy/conversation-bundles`
- `POST /integrations/legacy/approved-knowledge/promote`

Why:

- keeps legacy payloads out of core modules
- allows idempotency/versioning/auth in one place
- lets standalone translate legacy contracts into native services
- prevents legacy from becoming a second hidden runtime owner

This bridge should be implemented as an anti-corruption layer, not as a thin pass-through.

## Capability Mapping

### 1. Channel Configuration

#### Legacy Today

Lives across:

- `backend/src/channels/*`
- inbox/channel providers
- conversation/channel endpoints

#### Correct Standalone Ownership

The standalone runtime should own the effective channel behavior needed for chat execution:

- enabled/disabled
- supported channel profile
- greeting/wait/typing behavior if channel-relevant
- routing to async/sync chat intake

But channel credentials and connector mechanics can remain in legacy during transition.

#### Recommended Design

Add a standalone `ChannelConfigModule` backed by runtime-managed resources:

- key shape:
  - `tenantId`
  - `channelKey`
  - `version`
- payload examples:
  - `enabled`
  - `channelProfile`
  - `typingPolicy`
  - `coalescingPolicy`
  - `deliveryMode`
  - `legacyConnectorRef`

Legacy remains source-of-truth temporarily and pushes updates through the bridge.

### 2. Response Enable / Disable

#### Legacy Today

Legacy runtime config already has controls like:

- `enabled`
- `customerContentMode`
- `customerCommerceMode`
- `customerSchedulingMode`

#### Correct Standalone Ownership

These are not channel credentials. They are runtime policy.

They belong in standalone critical/runtime config, not in legacy AI service.

#### Recommended Design

Represent them in standalone as governed runtime config, for example:

- `response.enabled`
- `response.contentMode`
- `response.quoteMode`
- `response.bookingMode`
- `response.suggestions.enabled`
- `learning.enabled`
- `debug.capture.enabled`

Legacy should sync operator changes into standalone config versions through the bridge.

### 3. Debug Logic

#### Legacy Today

Legacy exposes:

- conversation debug endpoints
- `debugSummary`
- `auditPayload`
- AI-oriented operational traces

#### Correct Standalone Ownership

Debug must be rebuilt from standalone-owned artifacts:

- conversation state
- approved context
- retrieval matches
- response grounding
- chat logs
- async turn logs

#### Recommended Design

Do not port legacy debug blobs as-is.

Build a standalone admin/debug projection combining:

- conversation transcript
- state snapshot
- decision outcome
- document retrieval result
- prompt assembly summary
- response grounding detail
- trace/log timeline

Legacy may request that debug view, but must not remain the producer of debug truth.

### 4. Suggested Responses

#### Legacy Today

Legacy already tracks:

- approved suggestions
- used / edited / discarded feedback
- candidate and feedback stores

#### Correct Standalone Ownership

Suggested replies are conversational runtime artifacts and operator-learning signals.

They should be owned by standalone because they influence:

- response shaping
- quality loops
- learning
- operator tooling

#### Recommended Design

Add a standalone suggestion boundary with:

- suggestion candidate persistence
- operator feedback persistence
- conversation-level projection of approved suggestions
- separation between:
  - generated suggestion
  - operator final text
  - feedback outcome

Legacy should only submit feedback events through the bridge while it still hosts the operator UI.

### 5. Knowledge Ingestion From Approved Chats

#### Legacy Today

Legacy has:

- raw events
- candidates
- conversation bundles
- negative examples
- approved promotion flows

#### Correct Standalone Ownership

Knowledge derived from chats is part of the new runtime’s knowledge system.

It should be owned by standalone because it affects:

- future retrieval
- approved guidance
- learning loops
- operator trust

#### Recommended Design

Extend `/ai-platform` with a dedicated approved-conversation ingestion boundary, distinct from document ingestion:

- raw conversation event intake
- candidate extraction
- approved bundle promotion
- negative example capture
- optional promotion into:
  - structured knowledge
  - tenant guidance
  - response patterns

Legacy should not remain the long-term owner of those derived assets.

## Existing Standalone Pieces That Can Be Reused

Use these instead of inventing parallel systems:

- `chat/async` for channel-fed runtime intake
- `ChatLog` for traceability
- `ConversationState` for continuity
- runtime-managed resources for policy/config
- `LearningService` for post-response candidate extraction
- document knowledge view as precedent for grounded operator visibility
- prompt assembly for `base + tenant` composition

## Recommended New Standalone Modules

### 1. `LegacyIntegrationModule`

Purpose:

- accept signed/idempotent payloads from legacy
- translate them into standalone-native service calls

Responsibilities:

- tenant resolution
- source authentication
- idempotency checks
- version ordering
- payload normalization

### 2. `ChannelConfigModule`

Purpose:

- store effective runtime channel config for standalone

### 3. `SuggestionModule`

Purpose:

- standalone-owned suggested response lifecycle

### 4. `ConversationKnowledgeIngestionModule`

Purpose:

- approved chat -> knowledge / guidance / learning pipeline

### 5. `ConversationDebugProjectionModule`

Purpose:

- rebuild operator debug from standalone runtime artifacts

## Endpoint Strategy

### Use Existing Endpoints Where They Already Fit

- live embedded/public chat:
  - `/chat/message`
  - `/chat/async/messages`
  - `/chat/async/typing`
- documents:
  - `/admin/documents/*`
- knowledge listing:
  - `/admin/knowledge/*`
- runtime resources:
  - `/admin/runtime-resources/*`

### Do Not Reuse Admin Endpoints As Legacy Sync Contracts

Legacy sync should not call operator-admin endpoints directly because:

- auth model is different
- payload shape is different
- idempotency/versioning is different
- operator endpoints should remain human-oriented

## Recommended Bridge Contracts

The bridge should expose narrow legacy-facing contracts instead of reusing internal DTOs.

### 1. Channel Runtime Config Sync

- `POST /integrations/legacy/channel-configs/sync`

Recommended payload:

```json
{
  "tenantKey": "urucortinas",
  "source": "legacy",
  "externalId": "whatsapp:primary",
  "externalVersion": 12,
  "checksum": "sha256:...",
  "occurredAt": "2026-04-05T21:00:00.000Z",
  "idempotencyKey": "legacy-channel-config-whatsapp-primary-v12",
  "channelKey": "whatsapp_primary",
  "runtime": {
    "enabled": true,
    "channelProfile": "whatsapp_async",
    "deliveryMode": "async",
    "typingPolicy": {
      "enabled": true
    },
    "coalescingPolicy": {
      "quietWindowMs": 1500,
      "maxWindowMs": 4200
    },
    "legacyConnectorRef": "whatsapp-primary"
  }
}
```

Rules:

- full replacement of the standalone effective channel config
- bridge stores source metadata and external version
- stale versions must be ignored deterministically

### 2. Runtime Control Sync

- `POST /integrations/legacy/runtime-controls/sync`

Purpose:

- carry temporary operator controls still edited in legacy

Examples:

- response enabled / disabled
- suggestion generation enabled / disabled
- debug capture enabled / disabled

These values must land in standalone-managed runtime resources, not inline env state.

### 3. Inbound Message Intake

- `POST /integrations/legacy/messages/inbound`

This should normalize legacy channel traffic into standalone async intake shape and then hand off to:

- `AsyncTurnIntakeService`

Legacy payload should remain outside core runtime modules.

### 4. Suggestion Feedback

- `POST /integrations/legacy/suggestion-feedback`

Required semantics:

- idempotent
- conversation-scoped
- candidate-scoped
- captures:
  - suggested text
  - final operator text
  - used / edited / discarded
  - actor
  - timestamp

This should map into a standalone-owned suggestion lifecycle module, not directly into legacy tables.

### 5. Approved Conversation Bundle Promotion

- `POST /integrations/legacy/conversation-bundles`
- `POST /integrations/legacy/approved-knowledge/promote`

Purpose:

- migrate approved-chat learning into standalone ownership

These endpoints should feed:

- candidate extraction
- approved bundle promotion
- negative example capture
- optional promotion into:
  - structured knowledge
  - tenant guidance
  - response patterns

## Migration Blockers And Preconditions

### P0 Blockers

- do not point both Prisma apps to the same PostgreSQL schema
- do not let legacy keep generating chat responses after standalone becomes the runtime owner
- do not let legacy write directly into standalone runtime tables

### P0 Preconditions Before Cutover

- standalone bridge auth and idempotency implemented
- standalone runtime controls exist independently from legacy AI config
- inbound channel traffic can be forwarded to standalone reliably
- suggestion feedback can be stored natively in standalone
- approved-chat ingestion path exists in standalone

### P1 Preconditions Before Retiring Legacy AI Logic

- standalone debug projection replaces the minimum operator fields used today
- channel config sync supports versioning and stale-update rejection
- tenant mapping between `tenantKey` and standalone `tenantId` is explicit and tested

## Technical Risks

### P0

- same-schema database coexistence will corrupt migration ownership and table contracts
- legacy continuing to own response/learning while standalone also learns will create split truth
- direct DB writes from legacy into standalone tables will bypass tenant/runtime validation

### P1

- tenant identity mismatch between legacy `tenantKey` and standalone `tenantId`
- duplicate conversations if channel identity normalization differs
- double-learning from the same operator action if feedback events are replayed without idempotency
- stale runtime config if legacy pushes partial updates without version/checksum semantics

### P2

- operator UI drift if legacy shows old debug fields and standalone computes newer ones
- inconsistent response toggles if channel-level enablement and runtime-level enablement are mixed

## Recommended Guardrails

- every bridge payload must include:
  - `tenantKey`
  - `source`
  - `externalId`
  - `externalVersion`
  - `checksum`
  - `occurredAt`
  - `idempotencyKey`
- standalone stores source metadata for every synced artifact
- legacy-origin resources remain traceable as `origin=legacy_sync`
- no bridge endpoint may directly call model/provider code

## Migration Order

### Step 1

Move response enable/disable and runtime wording control into standalone-managed config.

### Step 2

Retarget legacy channel adapters so inbound messages call standalone chat intake instead of the old AI runtime.

### Step 3

Move suggestion feedback and approved suggestion lifecycle into standalone.

### Step 4

Move approved conversation ingestion and knowledge promotion into standalone.

### Step 5

Replace legacy debug views with standalone debug projections.

### Step 6

Retire legacy chat/runtime logic completely, leaving only channel connector mechanics until those are also replaced.

## What Must Not Be Migrated

- `services/ai-agent-service` orchestration
- provider-owned tool execution
- prompt-driven action decisioning
- legacy AI runtime state as authoritative truth
- legacy-generated debug blobs as the only explanation layer

## Recommendation

The right target is:

- legacy as temporary control plane and connector host
- standalone as the only conversational runtime and knowledge owner
- one PostgreSQL database infrastructure
- separate PostgreSQL schemas
- endpoint-based bridge between both systems

That preserves:

- operator continuity
- channel continuity
- existing infrastructure

while avoiding the real failure mode:

- a hidden split-brain runtime where both projects keep making chat, learning, and knowledge decisions independently.
