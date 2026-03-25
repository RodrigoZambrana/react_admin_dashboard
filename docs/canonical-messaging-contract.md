# Canonical Messaging Contract

## Objective

Define one shared behavioral contract for message threading, ordering, pagination and caching across:

- email inbox
- canonical conversations
- webchat
- WhatsApp
- Facebook Messenger
- Instagram Messaging

The goal is to stop treating `Emails` and `Conversations` as behaviorally different products. Channel-specific transport details may differ, but the user-facing rules for grouping, ordering and history loading must converge.

## Canonical Threading Rules

### Identity priority

Every inbound or outbound message must attempt to resolve its canonical thread using the following priority:

1. provider-native thread identifier
   - examples:
     - `externalThreadId`
     - `threadRemoteId`
     - provider conversation id
     - Gmail thread id
2. reply-chain identifiers
   - `message-id`
   - `in-reply-to`
   - `references`
3. stable channel participant fallback
   - `tenantKey + channel + inboxAccountId + externalUserId`
4. controlled heuristic fallback
   - normalized subject / normalized counterpart only as a last resort

### Canonical rules

- A new message that resolves to an existing thread must be merged into that same thread.
- A thread must never fragment only because the latest message is older in the local cache than the provider mailbox.
- Heuristic fallback may create provisional grouping, but a stronger provider identity must replace it when discovered later.
- Raw messages remain individually traceable even when grouped into one thread.

## Canonical Ordering Rules

- Thread lists must be ordered by `lastMessageAt DESC`.
- `lastMessageAt` is updated by:
  - new inbound message
  - new outbound message
  - provider status events only if they materially change delivery state and no newer message exists
- When an old thread receives a new reply, that thread must move to the top of the list.
- Detail view must show messages in chronological order ascending.

## Canonical Pagination Rules

### List pagination

- Every channel list must support incremental history loading.
- Preferred mechanisms:
  - explicit `Load more`
  - or infinite scroll
- Cursor-based pagination is preferred over offset pagination.

### Cursor semantics

- `nextCursor` means: older history exists and can be requested safely.
- `nextCursor = null` means: no older page is currently available from the canonical source.
- `since` is reserved for incremental refresh of newer messages, not older history.

### Sync completeness

Mailbox or thread views must expose one of:

- `complete`
- `partial`
- `syncing`

`partial` applies whenever:

- the provider reports more messages than the locally loaded window
- or `nextCursor` is still available

## Canonical Cache Rules

### Goals

- reduce repeated fetches for active lists/details
- avoid jarring reflow when navigating back to inbox/thread list
- preserve correctness under new message arrival

### Recommended cache strategy

- backend:
  - canonical DB persistence remains source of truth
  - short-lived in-memory or Redis cache only for derived list/detail views
- frontend:
  - keep per-channel list pages cached in state by cursor window
  - keep thread detail cache keyed by canonical conversation/thread id
  - invalidate or merge on live events

### Cache invalidation triggers

- new inbound message
- new outbound message
- message move / spam / folder change
- handoff / assignment if list metadata changes
- delivery-status event if the rendered badge changes

### Do not cache as source of truth

- raw provider sync state
- security-sensitive channel config
- unreviewed conversation-derived knowledge

## Convergence Plan

### Phase 1

- make `email inbox` honor cursor-based historical loading
- surface `partial` vs `complete` sync state
- converge email ordering to canonical `last activity` behavior

### Phase 2

- align `conversations` and `email inbox` on a shared thread identity policy
- remove divergent UI grouping heuristics where backend can provide canonical grouping

### Phase 3

- reuse the same contract in storefront-safe chat surfaces:
  - public chat without persistence
  - logged-in customer chat with persistence and scope-limited access

## Storefront Split

### Public chat

- no persisted thread history
- no privileged business data
- content/site/commerce assistance only
- must prompt login or registration before exposing customer-specific data or actions

### Logged-in customer chat

- persisted canonical conversation history
- customer-safe context only
- no admin-only cost or internal execution capabilities
- same ordering/threading contract as admin conversations
