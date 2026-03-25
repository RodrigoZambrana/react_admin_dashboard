# Architectural Decisions

## Active Decisions

### AI runtime stays decoupled

- `services/ai-agent-service` and `services/channel-adapter` remain independent services
- Reason: optional/beta capability, lower coupling, easier tenant packaging and rollback

### PostgreSQL + Redis split

- PostgreSQL is canonical persistence
- Redis is hot operational state for AI/inbox runtime
- Reason: durable history and audit from Postgres, low-latency context/locks from Redis

### Conversation hub is the canonical inbox domain

- `backend/src/conversations` is the source of truth for AI/human conversation state
- Existing `Inbox*` models remain valid for email transport and mailbox management
- Reason: preserve existing email/inbox functionality while converging channels into one operator-facing model

### CRM mail layout is the reference for conversations UI

- New conversation inbox surfaces should reuse the CRM mail interaction model
- Reason: operational continuity for users and lower UI complexity

### Inbox experiences are mobile-first

- Conversation inbox surfaces must remain fully usable on mobile devices
- Filters, list and detail panes should be accessible through responsive pane switching inspired by mature chat/mail products
- Reason: the primary operational usage is expected on mobile devices

### Generic AI actions must be backend-driven

- Generic action endpoints live in `backend/src/ai`
- AI services call backend contracts, never the database
- Reason: reusable SaaS-safe action layer and centralized validation/permissions

### AI runtime configuration is managed from admin but stored securely in backend

- Runtime provider/model/limits/messages are editable from the admin UI
- Provider secrets are stored through backend secure configuration, not in frontend code or Docker images
- AI runtime instances refresh configuration from backend instead of requiring manual restarts
- Reason: operational usability with centralized control and lower secret exposure

### Conversation grouping and traceability are mandatory

- All channels must group messages into a canonical conversation whenever a stable thread/user identity exists
- The database must preserve enough identifiers to reconstruct the conversation lifecycle without volatile runtime memory
- Tool execution must be auditable and linked back to the conversation/message that triggered it
- Reason: operational continuity, human takeover, compliance and debugging

### Unified inbox replies must preserve transport traceability

- Email replies sent from `conversations` must still persist through `InboxMessage` / `InboxMessageEvent`
- Non-email channels may dispatch through `channel-adapter`, but status updates must be projected back into the canonical conversation hub
- Reason: operators need one source of truth for message history, provider status and handoff continuity

### `admin_internal` lives in the same hub, not in a separate UI

- Internal operator-to-AI chat is modeled as `Conversation(scope=ADMIN_INTERNAL, channel=ADMIN_CHAT)`
- The same CRM inbox surface is reused for customer and internal scopes, with scope-aware prompts and actions
- Reason: operators need one inbox mental model with immediate switching between customer attention and internal assistance

## Assumptions

- The current tenant baseline is `urucortinas`
- The stack should remain reusable for future tenants
- Unified operator-human inbox is a phase 1 requirement, not a future enhancement

## Tradeoffs

- Short term there will be overlap between `Inbox*` and `Conversation*`
- This duplication is accepted temporarily to avoid destabilizing current email workflows while the unified hub matures
