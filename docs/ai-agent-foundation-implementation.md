# AI Agent Foundation Implementation Plan

Detailed runtime layout, env strategy, compose overlay, and memory contracts:

- [ai-agent-runtime-blueprint.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-agent-runtime-blueprint.md)

## Decision Summary

The AI initiative should not start on the current working branch.

Recommendation:

1. close the currently functional MVP on the active branch
2. cut a dedicated branch for the AI foundation
3. implement the AI stack there without destabilizing commerce, admin, and QA work already validated

Recommended branch name:

- `codex/ai-agent-foundation`
- current implementation branch in this repo: `codex-ai-agent-foundation`

Reasoning:

- the current branch already contains a meaningful commerce/admin hardening effort
- the AI feature introduces new domains, services, environment variables, and deployment concerns
- the AI feature is explicitly optional/beta and may not ship to production in the same shape
- a separate branch allows:
  - a clean MVP handoff on the current line
  - an experimental delivery lane for the AI foundation
  - easier rollback if the AI stack changes direction

## Implementation Scope

The first implementation should produce a functional foundation, not a full autonomous SaaS platform.

Phase 1 target:

- unified operator-human inbox in admin
- human takeover/release from the same conversation
- public customer chat and internal admin chat clearly separated
- backend `conversation-hub`
- AI service and channel adapter as independent services
- webchat first
- Meta channels and multiple email inboxes prepared in contracts

## Current Foundation Status

Implemented in `codex-ai-agent-foundation`:

- Prisma conversation domain:
  - `Conversation`
  - `ConversationParticipant`
  - `ConversationMessage`
  - `ConversationHandoffEvent`
  - `ConversationToolCall`
- backend module:
  - `backend/src/conversations`
- endpoints:
  - `GET /api/conversations`
  - `GET /api/conversations/:id`
  - `GET /api/conversations/inboxes`
  - `POST /api/conversations/webchat/session`
  - `POST /api/conversations/webchat/message`
  - `POST /api/conversations/:id/takeover`
  - `POST /api/conversations/:id/release`
  - `POST /api/conversations/:id/assign`
  - `POST /api/conversations/:id/reply`
  - `POST /api/conversations/:id/agent-reply`
- minimal admin UI:
  - `frontend/src/views/crm/Conversations`
- AI runtime slices:
  - `services/ai-agent-service`
  - `services/channel-adapter`
- storefront widget shell:
  - `ecommerce/src/components/ai-chat`
- smoke regression:
  - `ecommerce/e2e/admin-conversations.spec.ts`
  - `ecommerce/e2e/admin-conversation-actions.spec.ts`
  - `ecommerce/e2e/storefront-webchat.spec.ts`

Still intentionally out of scope for this slice:

- internal `admin_chat`
- external provider delivery
- durable tool-call audit persistence
- rich assignment UX and queue management
- transcript hydration from backend to storefront widget

## Real UI Implementation Phase

### Backend

Implemented now:

- canonical conversation hub in `backend/src/conversations`
- inbound `webchat session` and `webchat message`
- human `takeover`, `release`, `assign` and `reply`
- internal `agent-reply` protected by shared service token

Next backend phase:

- tool-call audit endpoints
- email/meta projected conversation creation
- richer inbox read models by channel and queue

### Frontend Admin

Implemented now:

- unified list/detail in `frontend/src/views/crm/Conversations`
- takeover/release controls
- operator reply composer
- basic assignment input
- handoff event history

Next admin UI phase:

- real operator selector
- queue/channel filters
- SLA and ownership indicators

### Storefront

Implemented now:

- session/message contract in `ecommerce/src/lib/api/conversations.ts`
- `webchat-context` orchestration
- launcher/drawer shell in `ecommerce/src/components/ai-chat`

Next storefront phase:

- transcript hydration from backend
- richer attachments and quick replies
- contextual launch points from product/order surfaces

### AI Runtime Services

Implemented now:

- `ai-agent-service` with provider abstraction, LangChain/OpenAI path and mock fallback
- `channel-adapter` with normalized `webchat`, `email` and `meta`
- `channel-adapter -> ai-agent-service -> backend` reply loop for webchat

Next runtime phase:

- `/api/ai/*` business tools
- external provider delivery and verification
- tenant-level policies for handoff and routing

## Reference Source Projects

External source projects available for reference:

- storefront base:
  - `/Users/rodrigo/Personal/Proyectos/react projects/bonik-themeforest-files 2/ecommerce_v2`
- admin base:
  - `/Users/rodrigo/Personal/Proyectos/react projects/Elstar - React Tailwind Admin Template/demo`

Recommended use of those sources:

- use them as structural and UI references only
- do not treat them as a merge source
- preserve the current repo as the source of truth for implemented business logic

Useful takeaways:

- Bonik is a good reference for:
  - webchat/storefront surface placement
  - layout composition in public pages
  - modular page-section organization
- Elstar is a good reference for:
  - admin route/config structure
  - inbox-style operational layouts
  - scalable view/component separation

## Architecture Placement

### Keep in core backend

- `backend/src/conversations`
- `backend/src/ai`
- permission checks
- business action endpoints under `/api/ai/*`
- conversation state, assignment state, and audit trail
- inbox projections for admin

### Keep as independent services

- `services/ai-agent-service`
- `services/channel-adapter`

### Keep in admin

- unified inbox UI
- takeover/release controls
- conversation detail
- operator actions and audit visibility

### Keep in storefront

- public webchat widget only
- no admin-only tools
- no privileged internal operations

## Prisma Proposal

The AI foundation should not replace the existing `Inbox*` models immediately.

The right approach is:

- preserve current `InboxAccount`, `InboxMessage`, `InboxQueue`, `InboxMessageEvent`
- add a new conversation layer
- project email and future channels into the new conversation layer

### New enums

```prisma
enum ConversationScope {
  CUSTOMER_PUBLIC
  ADMIN_INTERNAL
}

enum ConversationChannel {
  WEBCHAT
  EMAIL
  WHATSAPP
  FACEBOOK
  INSTAGRAM
  ADMIN_CHAT
}

enum ConversationControlMode {
  AI
  HUMAN
  HYBRID
}

enum ConversationStatus {
  OPEN
  CLOSED
  WAITING_CUSTOMER
  WAITING_INTERNAL
}

enum ConversationParticipantRole {
  CUSTOMER
  OPERATOR
  AGENT
  SYSTEM
}

enum ConversationMessageAuthorType {
  CUSTOMER
  OPERATOR
  AGENT
  SYSTEM
}

enum ConversationMessageKind {
  TEXT
  EMAIL
  IMAGE
  FILE
  SYSTEM_EVENT
  TOOL_RESULT
}

enum ConversationToolCallStatus {
  REQUESTED
  VALIDATED
  REJECTED
  CONFIRMED
  EXECUTED
  FAILED
}

enum ConversationHandoffEventType {
  HUMAN_TAKEOVER
  HUMAN_RELEASE
  AI_SUGGEST_ONLY
  AI_RESUME
  ASSIGNED
  UNASSIGNED
}
```

### New models

```prisma
model Conversation {
  id                 String                   @id @default(cuid())
  tenantKey          String
  scope              ConversationScope
  channel            ConversationChannel
  status             ConversationStatus       @default(OPEN)
  controlMode        ConversationControlMode  @default(AI)
  subject            String?
  customerId         Int?
  customer           Customer?                @relation(fields: [customerId], references: [id], onDelete: SetNull)
  assignedToUserId   Int?
  assignedToUser     User?                    @relation("ConversationAssignedOperator", fields: [assignedToUserId], references: [id], onDelete: SetNull)
  inboxAccountId     String?
  inboxAccount       InboxAccount?            @relation(fields: [inboxAccountId], references: [id], onDelete: SetNull)
  externalUserId     String?
  externalThreadId   String?
  externalChannelRef String?
  metadata           Json?
  lastMessageAt      DateTime?
  lastInboundAt      DateTime?
  lastOutboundAt     DateTime?
  closedAt           DateTime?
  createdAt          DateTime                 @default(now())
  updatedAt          DateTime                 @updatedAt
  participants       ConversationParticipant[]
  messages           ConversationMessage[]
  handoffEvents      ConversationHandoffEvent[]
  toolCalls          ConversationToolCall[]

  @@index([tenantKey, scope, channel, status])
  @@index([assignedToUserId, status, lastMessageAt])
  @@index([customerId, lastMessageAt])
  @@index([inboxAccountId, channel, lastMessageAt])
  @@unique([tenantKey, channel, externalThreadId])
}

model ConversationParticipant {
  id              String                      @id @default(cuid())
  conversationId  String
  conversation    Conversation                @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role            ConversationParticipantRole
  userId          Int?
  user            User?                       @relation(fields: [userId], references: [id], onDelete: SetNull)
  customerId      Int?
  customer        Customer?                   @relation(fields: [customerId], references: [id], onDelete: SetNull)
  externalUserId  String?
  displayName     String?
  metadata        Json?
  createdAt       DateTime                    @default(now())

  @@index([conversationId, role])
  @@index([userId])
  @@index([customerId])
}

model ConversationMessage {
  id               String                       @id @default(cuid())
  conversationId   String
  conversation     Conversation                 @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  authorType       ConversationMessageAuthorType
  kind             ConversationMessageKind      @default(TEXT)
  authorUserId     Int?
  authorUser       User?                        @relation("ConversationMessageAuthorUser", fields: [authorUserId], references: [id], onDelete: SetNull)
  authorCustomerId Int?
  authorCustomer   Customer?                    @relation("ConversationMessageAuthorCustomer", fields: [authorCustomerId], references: [id], onDelete: SetNull)
  externalMessageId String?
  inboxMessageId   String?
  inboxMessage     InboxMessage?                @relation(fields: [inboxMessageId], references: [id], onDelete: SetNull)
  body             String?
  normalizedText   String?
  payload          Json?
  metadata         Json?
  sentAt           DateTime?
  receivedAt       DateTime?
  createdAt        DateTime                     @default(now())

  @@index([conversationId, createdAt])
  @@index([externalMessageId])
  @@index([inboxMessageId])
}

model ConversationHandoffEvent {
  id               String                       @id @default(cuid())
  conversationId   String
  conversation     Conversation                 @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  type             ConversationHandoffEventType
  actorUserId      Int?
  actorUser        User?                        @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  previousMode     ConversationControlMode?
  nextMode         ConversationControlMode?
  notes            String?
  metadata         Json?
  createdAt        DateTime                     @default(now())

  @@index([conversationId, createdAt])
}

model ConversationToolCall {
  id               String                       @id @default(cuid())
  conversationId   String
  conversation     Conversation                 @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  messageId        String?
  message          ConversationMessage?         @relation(fields: [messageId], references: [id], onDelete: SetNull)
  toolName         String
  status           ConversationToolCallStatus   @default(REQUESTED)
  requestedBy      ConversationMessageAuthorType
  requestedByUserId Int?
  requestedByUser  User?                        @relation(fields: [requestedByUserId], references: [id], onDelete: SetNull)
  validatedPayload Json?
  resultPayload    Json?
  errorCode        String?
  errorMessage     String?
  createdAt        DateTime                     @default(now())
  updatedAt        DateTime                     @updatedAt

  @@index([conversationId, status, createdAt])
  @@index([messageId])
}
```

## Why this schema instead of extending Inbox directly

- `Inbox*` is transport/email-centric
- conversations need:
  - control mode
  - operator assignment
  - AI audit
  - tool execution
  - cross-channel continuity
- forcing those concerns into `InboxMessage` would over-couple email transport and AI orchestration

Recommended relationship:

- transport adapters create or attach `InboxMessage`
- `conversation-hub` links those messages into `ConversationMessage`
- admin inbox reads from `Conversation`

## Backend Modules

### `backend/src/conversations`

Suggested structure:

- `conversations.module.ts`
- `conversations.controller.ts`
- `conversations.service.ts`
- `conversations.repository.ts`
- `dto/`
  - `list-conversations.dto.ts`
  - `conversation-reply.dto.ts`
  - `conversation-takeover.dto.ts`
  - `conversation-release.dto.ts`
  - `conversation-webchat-session.dto.ts`
- `policies/`
  - `conversation-scope.policy.ts`
  - `conversation-assignment.policy.ts`
- `mappers/`
  - `conversation-inbox.mapper.ts`
  - `conversation-channel.mapper.ts`
- `events/`
  - `conversation-events.service.ts`

Responsibilities:

- canonical conversation lifecycle
- human/AI control switching
- projection to unified inbox
- conversation detail query
- safe reply orchestration

### `backend/src/ai`

Suggested structure:

- `ai.module.ts`
- `ai.controller.ts`
- `ai.service.ts`
- `ai-authz.service.ts`
- `dto/`
  - `search-products.dto.ts`
  - `generate-quote.dto.ts`
  - `create-order-draft.dto.ts`
  - `confirm-ai-action.dto.ts`
- `guards/`
  - `ai-scope.guard.ts`
  - `ai-confirmation.guard.ts`
- `mappers/`
  - `ai-order.mapper.ts`
  - `ai-product.mapper.ts`

Responsibilities:

- expose safe business tools for the AI runtime
- validate intent and parameters
- enforce scope and permission boundaries

### Reuse existing modules

- `backend/src/inbox`
  - email transport/account configuration
- `backend/src/customers`
  - customer resolution
- `backend/src/orders`
  - order lifecycle and timeline
- `backend/src/email`
  - customer/admin email sending

## First API Surface

### Conversation API

- `GET /api/conversations`
- `GET /api/conversations/:id`
- `POST /api/conversations/:id/takeover`
- `POST /api/conversations/:id/release`
- `POST /api/conversations/:id/reply`
- `POST /api/conversations/webchat/session`
- `GET /api/conversations/inboxes`

### AI-safe business API

- `GET /api/ai/products`
- `GET /api/ai/products/:id`
- `POST /api/ai/generate-quote`
- `POST /api/ai/create-appointment`
- `POST /api/ai/create-order`
- `GET /api/ai/order-status`
- `POST /api/ai/resolve-customer`
- `POST /api/ai/validate-action`
- `POST /api/ai/confirm-action`

## Security Model

The AI foundation must enforce these boundaries from day one:

- no direct Prisma access from `ai-agent-service`
- public customer scope and admin internal scope use different tool allowlists
- human takeover always overrides AI autonomy
- AI cannot silently reclaim a human-owned thread
- all tool calls carry:
  - `tenantKey`
  - `scope`
  - `authLevel`
  - `conversationId`
- inbound text is sanitized at channel boundary and tool boundary
- no sensitive payloads in logs

## Branching Strategy

Recommended operational strategy:

1. finish and commit the current stabilized MVP work on the active branch
2. tag or mark that branch as the reference MVP line for testing/use
3. create `codex/ai-agent-foundation` from that point
4. implement the AI foundation there
5. merge only after:
   - conversation-hub contracts are stable
   - inbox UI works with takeover
   - webchat flow is usable end to end

Why not implement it directly here:

- it would mix hardening work with a net-new architecture
- it increases review and rollback cost
- it makes MVP closure harder
- AI remains explicitly optional/beta

## MVP Sequence

### Step 1

- introduce documentation and contracts only
- no runtime changes yet

### Step 2

- add `backend/src/conversations` skeleton
- add Prisma migration for new conversation models
- no AI decisions yet
- just support:
  - webchat session creation
  - manual human inbox flow

### Step 3

- add `services/ai-agent-service`
- add read-only product/order tools
- add suggestion mode first

### Step 4

- enable takeover/release
- allow validated actions with confirm pattern

### Step 5

- add email channel projection
- add WhatsApp/Instagram/Facebook adapters

## Recommended Next Commit Scope

For the next AI-specific branch, the first safe implementation batch should be:

- Prisma enums and models for `Conversation*`
- `backend/src/conversations` module skeleton
- admin inbox read model contract
- webchat conversation session endpoint
- no autonomous tool execution yet

That gives a concrete foundation without destabilizing the currently working commerce MVP.
