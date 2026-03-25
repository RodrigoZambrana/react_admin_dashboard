# AI Agent Runtime Blueprint

## Objective

Define the exact project layout and deployment strategy for the AI stack without
mixing the experimental runtime into the already functional commerce stack.

This blueprint assumes:

- `backend` remains the canonical business API and source of truth
- `frontend` remains the admin surface
- `ecommerce` remains the storefront surface
- AI runtime and channel ingress live in independent services
- `Postgres` is the canonical persistence layer
- `Redis` is enabled from the first AI-capable docker stack for hot memory/cache/locks
- `Postgres` remains outside the AI overlay and outside the application containers, preserving its current independent lifecycle

## Placement Decision

Do **not** create a new top-level repo-wide `/src/ai`.

Recommended placement:

- `backend/src/conversations`
- `backend/src/ai`
- `services/ai-agent-service/src/ai`
- `services/channel-adapter/src`

Reason:

- the agent runtime is optional/beta
- the backend should expose contracts and permissions, not host the whole model loop
- the adapter layer must stay independent from business logic and vendor SDKs

## Exact Folder Tree

### Backend

```txt
backend/src
├── ai/
│   ├── ai.module.ts
│   ├── ai.controller.ts
│   ├── ai.service.ts
│   ├── dto/
│   │   ├── create-appointment.dto.ts
│   │   ├── create-order.dto.ts
│   │   ├── generate-quote.dto.ts
│   │   ├── resolve-customer.dto.ts
│   │   └── validate-action.dto.ts
│   ├── policies/
│   │   ├── ai-scope.policy.ts
│   │   ├── ai-tool-permissions.policy.ts
│   │   └── ai-confirmation.policy.ts
│   └── presenters/
│       ├── ai-product.presenter.ts
│       ├── ai-order.presenter.ts
│       └── ai-customer.presenter.ts
├── conversations/
│   ├── conversations.module.ts
│   ├── conversations.controller.ts
│   ├── conversations.service.ts
│   ├── dto/
│   │   ├── list-conversations.dto.ts
│   │   ├── create-webchat-session.dto.ts
│   │   ├── reply-conversation.dto.ts
│   │   ├── assign-conversation.dto.ts
│   │   ├── takeover-conversation.dto.ts
│   │   └── release-conversation.dto.ts
│   ├── presenters/
│   │   ├── conversation-summary.presenter.ts
│   │   └── conversation-detail.presenter.ts
│   └── __tests__/
│       └── conversations.service.spec.ts
└── inbox/
    └── ...
```

### AI Agent Service

```txt
services/ai-agent-service
├── Dockerfile
├── package.json
└── src
    ├── main.js
    ├── config/
    │   ├── env.ts
    │   └── feature-flags.ts
    ├── ai/
    │   ├── agent.ts
    │   ├── orchestration/
    │   │   ├── conversation-runner.ts
    │   │   ├── intent-validator.ts
    │   │   └── action-confirmation.ts
    │   ├── prompt/
    │   │   ├── system-prompt.ts
    │   │   ├── customer-public.prompt.ts
    │   │   └── admin-internal.prompt.ts
    │   ├── tools/
    │   │   ├── index.ts
    │   │   ├── search-products.tool.ts
    │   │   ├── generate-quote.tool.ts
    │   │   ├── create-appointment.tool.ts
    │   │   ├── create-order-draft.tool.ts
    │   │   └── confirm-order.tool.ts
    │   ├── memory/
    │   │   ├── memory-store.ts
    │   │   ├── context-cache-store.ts
    │   │   ├── in-memory-conversation-store.ts
    │   │   ├── redis-conversation-store.ts
    │   │   └── context-builder.ts
    │   ├── model/
    │   │   ├── model-provider.ts
    │   │   ├── openai-provider.ts
    │   │   └── ollama-provider.ts
    │   └── guardrails/
    │       ├── prompt-injection.guard.ts
    │       ├── tool-execution.guard.ts
    │       ├── pii-redaction.ts
    │       └── rate-limit.policy.ts
    ├── clients/
    │   ├── backend-ai.client.ts
    │   └── conversations.client.ts
    ├── application/
    │   ├── inbound-message.service.ts
    │   ├── outbound-message.service.ts
    │   └── handoff.service.ts
    └── observability/
        ├── audit-log.ts
        └── metrics.ts
```

### Channel Adapter

```txt
services/channel-adapter
├── Dockerfile
├── package.json
└── src
    ├── main.js
    ├── normalization/
    │   ├── unified-message.ts
    │   ├── unified-delivery.ts
    │   └── sanitization.ts
    ├── channels/
    │   ├── meta/
    │   │   ├── meta-webhook.controller.ts
    │   │   ├── whatsapp.adapter.ts
    │   │   ├── instagram.adapter.ts
    │   │   └── messenger.adapter.ts
    │   ├── email/
    │   │   ├── email-webhook.controller.ts
    │   │   ├── email-ingress.adapter.ts
    │   │   └── email-egress.adapter.ts
    │   └── webchat/
    │       ├── webchat.controller.ts
    │       └── webchat.adapter.ts
    ├── clients/
    │   ├── ai-agent.client.ts
    │   └── conversations.client.ts
    └── delivery/
        ├── outbound-dispatcher.ts
        └── retry-policy.ts
```

### Frontend Admin Inbox

```txt
frontend/src
├── services/
│   └── ConversationsService.ts
├── views/
│   └── crm/
│       ├── Conversations/
│       │   ├── Conversations.tsx
│       │   ├── index.ts
│       │   ├── components/
│       │   │   ├── ConversationsSidebar.tsx
│       │   │   ├── ConversationsList.tsx
│       │   │   ├── ConversationDetail.tsx
│       │   │   ├── ConversationComposer.tsx
│       │   │   ├── ConversationHeader.tsx
│       │   │   └── ConversationFilters.tsx
│       │   └── store/
│       │       ├── conversationsSlice.ts
│       │       └── index.ts
│       └── Mail/
│           └── ...
└── configs/
    ├── routes.config/
    └── navigation.config/
```

### Storefront Webchat

```txt
ecommerce/src
├── components/
│   └── ai-chat/
│       ├── WebchatLauncher.tsx
│       ├── WebchatDrawer.tsx
│       ├── WebchatConversation.tsx
│       ├── WebchatComposer.tsx
│       └── WebchatMessage.tsx
├── lib/
│   └── api/
│       └── conversations.ts
├── state/
│   └── webchat-context.tsx
└── types/
    └── conversations.ts
```

## Docker Compose Strategy

### Recommendation

Keep current compose files as they are for the MVP already running.

Add the AI stack as an **overlay compose file**, not by bloating the existing
base compose immediately.

Recommended new file:

- `deploy/docker-compose.ai-agent.yml`

Usage:

- dev with Redis from day 1:
  - `docker compose -f deploy/docker-compose.dev.yml -f deploy/docker-compose.ai-agent.yml --profile ai up -d`
- prod/testing with Redis:
  - `docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.ai-agent.yml --profile ai --profile ai-cache up -d`

### Exact compose overlay

```yml
services:
  ai-agent-service:
    profiles: ["ai"]
    build:
      context: ../services/ai-agent-service
      dockerfile: Dockerfile
    container_name: dashboard-ai-agent-dev
    env_file:
      - path: ./env/ai-agent.dev.env
        required: false
      - path: ./env/.env.ai-agent.dev.local
        required: false
    environment:
      PORT: ${AI_AGENT_PORT:-4100}
      BACKEND_BASE_URL: http://backend:4000/api
      CONVERSATIONS_BASE_URL: http://backend:4000/api/conversations
      AI_MEMORY_DRIVER: ${AI_MEMORY_DRIVER:-redis}
      REDIS_ENABLED: ${REDIS_ENABLED:-true}
      REDIS_URL: ${REDIS_URL:-redis://redis:6379}
    depends_on:
      - backend
      - redis
    ports:
      - "${AI_AGENT_PORT:-4100}:4100"

  channel-adapter:
    profiles: ["ai"]
    build:
      context: ../services/channel-adapter
      dockerfile: Dockerfile
    container_name: dashboard-channel-adapter-dev
    env_file:
      - path: ./env/channel-adapter.dev.env
        required: false
      - path: ./env/.env.channel-adapter.dev.local
        required: false
    environment:
      PORT: ${CHANNEL_ADAPTER_PORT:-4200}
      BACKEND_BASE_URL: http://backend:4000/api
      AI_AGENT_BASE_URL: http://ai-agent-service:4100
      REDIS_URL: ${REDIS_URL:-redis://redis:6379}
    depends_on:
      - backend
      - ai-agent-service
      - redis
    ports:
      - "${CHANNEL_ADAPTER_PORT:-4200}:4200"

  redis:
    profiles: ["ai", "ai-cache"]
    image: redis:7-alpine
    container_name: dashboard-redis-dev
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "${REDIS_PORT:-6379}:6379"
```

## Environment Variables

### AI Agent Service

Dev:

```env
PORT=4100
NODE_ENV=development
AI_MODEL_PROVIDER=openai
AI_MODEL_NAME=gpt-4o-mini
OPENAI_API_KEY=
OPENAI_SPENDING_LIMIT_USD=15
BACKEND_BASE_URL=http://backend:4000/api
CONVERSATIONS_BASE_URL=http://backend:4000/api/conversations
AI_MEMORY_DRIVER=redis
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379
AI_CONTEXT_MAX_TURNS=20
AI_SCOPE_DEFAULT=customer_public
AI_ADMIN_SCOPE_ENABLED=true
```

Prod:

```env
PORT=4100
NODE_ENV=production
AI_MODEL_PROVIDER=openai
AI_MODEL_NAME=gpt-4o-mini
OPENAI_API_KEY=
OPENAI_SPENDING_LIMIT_USD=200
BACKEND_BASE_URL=http://backend:4000/api
CONVERSATIONS_BASE_URL=http://backend:4000/api/conversations
AI_MEMORY_DRIVER=redis
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379
AI_CONTEXT_MAX_TURNS=30
AI_SCOPE_DEFAULT=customer_public
AI_ADMIN_SCOPE_ENABLED=true
```

### Channel Adapter

Dev:

```env
PORT=4200
NODE_ENV=development
BACKEND_BASE_URL=http://backend:4000/api
AI_AGENT_BASE_URL=http://ai-agent-service:4100
META_VERIFY_TOKEN=
META_APP_SECRET=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
INSTAGRAM_ACCESS_TOKEN=
MESSENGER_PAGE_ACCESS_TOKEN=
EMAIL_INGRESS_ENABLED=false
EMAIL_EGRESS_ENABLED=false
```

Prod:

```env
PORT=4200
NODE_ENV=production
BACKEND_BASE_URL=http://backend:4000/api
AI_AGENT_BASE_URL=http://ai-agent-service:4100
META_VERIFY_TOKEN=
META_APP_SECRET=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
INSTAGRAM_ACCESS_TOKEN=
MESSENGER_PAGE_ACCESS_TOKEN=
EMAIL_INGRESS_ENABLED=true
EMAIL_EGRESS_ENABLED=true
```

## Memory Interfaces

### Canonical Rule

- `Postgres` stores the conversation truth
- `Redis` stores hot memory and runtime state
- `in-memory` should remain a local fallback only, not the default for the stack

### Conversation hot memory

```ts
export type MemoryTurn = {
  role: 'customer' | 'operator' | 'agent' | 'system'
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export type ConversationMemorySnapshot = {
  conversationId: string
  scope: 'customer_public' | 'admin_internal'
  turns: MemoryTurn[]
  summary?: string | null
  compiledContext?: string | null
  updatedAt: string
}

export interface ConversationMemoryStore {
  get(conversationId: string): Promise<ConversationMemorySnapshot | null>
  appendTurn(conversationId: string, turn: MemoryTurn): Promise<void>
  replace(conversationId: string, snapshot: ConversationMemorySnapshot): Promise<void>
  clear(conversationId: string): Promise<void>
}
```

### Context cache

```ts
export interface ContextCacheStore {
  getCompiledContext(conversationId: string): Promise<string | null>
  setCompiledContext(
    conversationId: string,
    compiledContext: string,
    ttlSeconds?: number,
  ): Promise<void>
  invalidate(conversationId: string): Promise<void>
}
```

### Recommended implementations

- dev:
  - `RedisConversationStore`
  - `RedisContextCacheStore`
  - allow `in-memory` only as local fallback when the AI overlay is intentionally not running
- prod:
  - `RedisConversationStore`
  - `RedisContextCacheStore`

## Activation Strategy by Environment

### Development

Recommended default:

- backend + frontend + storefront: always on
- ai-agent-service + channel-adapter: opt-in by profile
- Redis: on from day 1 when the AI profile is enabled

Settings:

- `AI_MEMORY_DRIVER=redis`
- `REDIS_ENABLED=true`

Why:

- keeps dev behavior closer to production
- avoids rewriting activation rules later
- enables locks, dedupe and hot context semantics from the start

### Testing

Recommended:

- AI services on for integration runs
- Redis preferred by default

Use cases:

- fast local-only contract testing:
  - `in-memory` is still acceptable
- multi-instance / lock / cache testing:
  - `redis`

### Production

Recommended:

- AI services enabled only for tenants that use them
- Redis required

Settings:

- `AI_MEMORY_DRIVER=redis`
- `REDIS_ENABLED=true`

Reason:

- multiple instances
- shared hot memory
- rate limiting
- dedupe
- tool locks
- better latency for context assembly

## Immediate Next Implementation Step

Do this next, in order:

1. keep current `backend/src/conversations` as canonical hub
2. add takeover/release/reply endpoints in backend
3. expand `services/ai-agent-service` from health/config to LangChain runtime
4. expand `services/channel-adapter` from health/webhook placeholder to real normalization
5. add storefront webchat client contract
6. add reply routing and unified inbox mutations in admin

## Current Implementation Snapshot

Already implemented on `codex-ai-agent-foundation`:

- backend conversation hub with:
  - `takeover`
  - `release`
  - `assign`
  - operator `reply`
  - `webchat message`
  - internal `agent-reply`
- `services/ai-agent-service` runtime with:
  - provider abstraction
  - LangChain/OpenAI path
  - mock fallback
  - hot memory store
  - product search tool against backend
- `services/channel-adapter` runtime with:
  - `webchat`, `email`, `meta` normalization
  - `webchat -> AI -> conversations` reply loop
- storefront webchat shell:
  - launcher
  - drawer
  - session/message contract
- admin conversations UI with:
  - list/detail
  - takeover/release
  - assign
  - operator reply
  - handoff history
