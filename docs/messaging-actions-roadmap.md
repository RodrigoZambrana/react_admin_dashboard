# Messaging Actions Roadmap

## Current stage

- `read / unread` is now real per operator in backend via `ConversationReadState`.
- `pin` remains intentionally persisted in local UI storage for this stage to close the admin inbox experience without adding more shared-state surface.
- `reply` is available from the selected conversation and already projects through the canonical conversation hub.

## Recommended message-level actions

### Stage A — safe operator actions

- `pin conversation`
- `mark read / unread`
- `favorite conversation`
- `copy conversation id`
- `copy message text`
- `open contact details`
- `reply from active thread`

### Stage B — message ergonomics

- `react to message`
- `star/favorite message`
- `download attachment`
- `open image / audio / video preview`
- `quote/reply to a specific message`

### Stage C — controlled mutable actions

- `edit operator draft before send`
- `delete operator outbound before provider delivery`
- `soft-delete internal note`
- `retry outbound delivery`

These should not be exposed as general-purpose destructive actions until transport rules are explicit per provider.

## Provider compatibility guidance

### Meta channels

- `reaction`
  - viable when the provider exposes message reaction APIs
  - must be mapped as an outbound action linked to a concrete provider message id
- `reply to message`
  - should use provider reply/thread identifiers when available
- `edit/delete`
  - generally not safe to assume as universally supported
  - treat as provider-dependent and feature-flagged
- `attachments`
  - should remain canonical in conversation payloads and transport metadata
  - actual upload/send lifecycle belongs to provider adapters

### Email

- `reaction`
  - not a meaningful transport feature
- `favorite / pin`
  - operator-local or operator-shared inbox state, not provider state
- `reply to message`
  - maps to canonical thread + provider message references (`message-id`, `in-reply-to`, `references`)
- `edit/delete`
  - limited to draft/local state before send

## Canonical modeling guidance

Message actions should be represented as:

- canonical conversation/message intent in backend
- provider capability resolution in adapters
- provider result/status projected back into the conversation hub

Recommended future entities or projections:

- `ConversationReaction`
- `ConversationFavoriteState`
- `ConversationMessageActionEvent`
- `ConversationDraft`

## Acceptance criteria for future implementation

- every action must declare:
  - whether it is local-only, operator-shared or provider-backed
  - whether it is reversible
  - whether it requires provider capability checks
  - how it is audited in the conversation timeline
- no action should bypass the canonical conversation hub
- Meta/email/webchat integrations must project action outcomes back into the same conversation detail
