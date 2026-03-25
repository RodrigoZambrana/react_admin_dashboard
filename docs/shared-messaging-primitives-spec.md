# Shared Messaging Primitives Spec

## Objective

Create a reusable messaging UI layer that can serve:

- `frontend` admin inbox and operator workflows
- `ecommerce` public chat with restricted access
- `ecommerce` logged-in customer chat with persisted conversation history

The goal is to avoid duplicating messaging layout logic across products while keeping permissions, persistence and runtime scope clearly separated.

## Design Principles

- one messaging visual language, multiple scopes
- mobile-first behavior is mandatory
- transcript and composer are always primary
- contextual/operational panels move to drawers or secondary panes
- the UI layer must not decide permissions or data visibility
- public storefront chat must never receive admin-only data

## Initial Primitive Set

Shared primitives live in:

- [frontend/src/components/messaging](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/components/messaging)

Current baseline primitives:

- `MessagingShell`
  - 3-pane composition contract: sidebar, list, detail
  - supports desktop sidebar and responsive pane composition
- `MessagingPaneHeader`
  - standard detail header with leading/trailing actions
- `MessagingConversationListItem`
  - inbox row for chat/email-style lists
- `MessagingMessageBubble`
  - transcript message surface with badges and transport metadata
- `MessagingComposer`
  - compact input + send action layout

## Admin Consumer

First consumer is:

- [frontend/src/views/crm/Conversations/Conversations.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/crm/Conversations/Conversations.tsx)

Admin uses the full primitive set plus:

- queue controls
- ownership / SLA
- takeover / release
- tool calls
- internal AI actions
- multichannel inbox

These remain outside the shared primitives as domain-specific operational layers.

## Storefront Split

### Public chat

Scope:

- anonymous visitor
- no persistence requirement in first phase
- focused on:
  - site content
  - commercial guidance
  - general product discovery
- no access to:
  - costs
  - internal tools
  - customer private data
  - order mutation without authentication

Behavior:

- safe subset of transcript + composer + minimal header
- can request sign-in when the user asks for protected information or actions

### Logged-in customer chat

Scope:

- authenticated customer
- persisted conversation required
- can use customer-safe conversation contracts and order/account context
- can access:
  - own order status
  - own account-linked guidance
  - customer-safe operational help

Still excluded:

- admin-only tools
- internal costs
- privileged operational actions outside customer permissions

## Backend Contract Expectations

Shared primitives assume backend read models already separate:

- `customer_public`
- `admin_internal`

The UI layer must consume scope-safe DTOs. It must not hide unsafe fields client-side as a security mechanism.

## Incremental Adoption Plan

1. Extract and stabilize shared primitives in `frontend`
2. Keep `admin conversations` as first production consumer
3. Define storefront-safe adapter components using a restricted subset
4. Implement public chat consumer without persistence
5. Implement logged-in customer chat consumer with persisted conversation contracts

## Non-goals

- moving all messaging business logic to frontend
- sharing operator-only controls with storefront
- sharing DTOs without scope filtering
