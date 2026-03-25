# Architecture Baseline

## Trusted Runtime Structure

- `backend`: NestJS + Fastify + Prisma + PostgreSQL
- `frontend`: React + TypeScript admin
- `ecommerce`: Next.js storefront
- `services/ai-agent-service`: optional AI runtime
- `services/channel-adapter`: optional multichannel ingress/egress service
- `deploy/`: compose files and environment overlays

## Source of Truth

- PostgreSQL is the canonical persistence layer
- `backend` owns business rules and internal data contracts
- `frontend` and `ecommerce` must consume validated HTTP contracts
- `services/ai-agent-service` must never access the database directly
- `services/channel-adapter` must never own business state

## Canonical Integration Pattern

1. Channel receives or emits message
2. `channel-adapter` normalizes payload
3. `backend/src/conversations` persists canonical conversation state
4. `ai-agent-service` reads/writes only through backend endpoints
5. `frontend` reads the unified read model
6. `ecommerce` uses only customer-safe conversation contracts

Outbound additions:

7. Operator or AI replies are created from `backend/src/conversations`
8. Email uses `InboxService` as real transport and persistence path
9. Meta-family outbound goes through `channel-adapter`, then syncs status back to the hub through internal backend contracts

## Persistence Baseline For Conversations

Every inbound or outbound message must preserve enough data to reconstruct operational history without relying on volatile memory.

Minimum persisted traceability:

- conversation grouping:
  - `tenantKey`
  - `scope`
  - `channel`
  - `externalThreadId`
  - `externalUserId`
  - `inboxAccountId` when available
- message traceability:
  - `externalMessageId`
  - `inboxMessageId` when available
  - `authorType`
  - `kind`
  - `body` / `normalizedText`
  - `sentAt` / `receivedAt`
  - delivery status and provider identifiers
  - channel/provider metadata
  - transport event history when available
- operational traceability:
  - participants
  - assignment and takeover events
  - queue/inbox linkage
  - tool call audit records

Conversation grouping is mandatory. Messages from the same user/thread must resolve to the same conversation whenever a stable thread identity exists.

## Conversation Boundaries

- `customer_public`
  - storefront webchat
  - email support inboxes
  - WhatsApp / Instagram / Facebook
- `admin_internal`
  - internal admin assistant/chat
  - operational tasks and admin-only actions
  - same inbox UI, separate prompt/tool scope and permissions

These scopes must differ in:

- permissions
- prompts
- tools
- routing defaults

## AI Knowledge Sources

The AI layer must consume a tiered knowledge system rather than raw undifferentiated text.

Primary knowledge sources:

- curated documentation and business rules
- validated backend datasets such as products and safe customer context
- curated admin-authored knowledge
- approved conversation-derived knowledge

Operational rule:

- raw inbound/outbound conversations may generate candidates, but they are not trusted retrieval input until they are redacted and approved

Current persisted knowledge baseline:

- `KnowledgeDocument`
  - curated documentation, trusted dataset projections and approved admin-authored or conversation-derived knowledge
- `KnowledgeCandidate`
  - redacted excerpts derived from conversations, pending operator review
- first ingestion jobs currently cover:
  - trusted repo docs mounted into backend runtime
  - product summaries
  - sanitized customer summaries
- admin runtime settings expose:
  - docs ingestion
  - dataset ingestion
  - manual curated entry creation
  - candidate approve/reject actions
  - manual reindex of approved retrieval corpus

Current retrieval baseline:

- `KnowledgeDocumentEmbedding`
  - 1:1 projection of approved `KnowledgeDocument`
  - stores provider, model, dimensions, content hash and vector payload
- indexing behavior:
  - synchronous indexing on curated creation, trusted ingestion and candidate promotion
  - explicit bulk reindex endpoint for admin operations
- ranking behavior:
  - lexical score + vector similarity over approved documents only
  - `customer_public` queries search only approved public knowledge
  - `admin_internal` queries can use both internal and public approved knowledge

This is intentionally a low-friction first step. Vector storage is in PostgreSQL JSON and ranking is computed in backend memory. A dedicated vector store or provider-backed embeddings can be layered later without changing the approval boundary.

Conversation-derived knowledge must never skip the candidate stage.

## Queue Ownership And SLA Baseline

- `InboxQueue` stores:
  - priority
  - SLA target minutes
  - assignment mode
  - optional max assigned conversations
- `InboxQueueUserAssignment` stores:
  - active operators per queue
  - primary operator flag
  - per-operator capacity override
- inbound conversations may auto-assign on creation when the queue uses `LEAST_LOADED`
- queue metrics exposed to admin must include:
  - open count
  - waiting customer count
  - unassigned count
  - breached SLA count
  - operator count
  - assigned load
  - configured and available capacity

## Deployment Baseline

- Main stack stays in `deploy/docker-compose.dev.yml`
- AI stack overlays through `deploy/docker-compose.ai-agent.yml`
- Redis is enabled in the AI overlay from day 1 for hot memory, locks and rate limiting
- PostgreSQL remains external to the application containers, preserving independent lifecycle and backups

## UI Baseline

- CRM mail layout is the reference layout for inbox-style operational views
- New conversation inbox surfaces should reuse the same operator mental model:
  - sidebar filters
  - list
  - detail
  - composer/actions
- Mobile-first responsiveness is mandatory for inbox/conversation surfaces
- On small screens, filters, list and detail should remain accessible through simple pane switching patterns similar to mature messaging products
- shared messaging UI primitives now live in:
  - [frontend/src/components/messaging](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/components/messaging)
- admin is the first full consumer of that layer
- storefront must consume only a restricted subset:
  - public chat without persistence and without privileged data
  - authenticated customer chat with persisted history and customer-safe access only

## Config Resolution Baseline

- for inbox email runtime:
  - when secure config exists in database, database is the source of truth
  - environment variables are bootstrap/fallback only when no secure config record exists yet
- blank env values must never collapse numeric defaults to `0`

## Quality Baseline

- Changes must preserve:
  - build integrity
  - Prisma validity
  - critical QA blocks
  - type safety
- New functionality must carry:
  - regression coverage where practical
  - `data-testid` on interactive surfaces used by E2E

## Endpoint Protection Baseline

- Minimum endpoint protections are a system-wide acceptance criterion, not an inbox-only concern
- Every externally reachable HTTP endpoint must be reviewed for:
  - authentication and authorization
  - role/scope enforcement when applicable
  - rate limiting
  - allowed-origin restrictions
  - internal-only vs public exposure boundaries
- Existing controls such as global throttling, CORS and controller guards are not sufficient by assumption alone; they must be audited per module and per surface
- No new channel rollout should be considered complete until the relevant endpoints pass this protection audit
