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

## Conversation Boundaries

- `customer_public`
  - storefront webchat
  - email support inboxes
  - WhatsApp / Instagram / Facebook
- `admin_internal`
  - internal admin assistant/chat
  - operational tasks and admin-only actions

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

## Quality Baseline

- Changes must preserve:
  - build integrity
  - Prisma validity
  - critical QA blocks
  - type safety
- New functionality must carry:
  - regression coverage where practical
  - `data-testid` on interactive surfaces used by E2E
