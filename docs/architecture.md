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

## Quality Baseline

- Changes must preserve:
  - build integrity
  - Prisma validity
  - critical QA blocks
  - type safety
- New functionality must carry:
  - regression coverage where practical
  - `data-testid` on interactive surfaces used by E2E
