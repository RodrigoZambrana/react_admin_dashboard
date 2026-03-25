# Tasks

## Backlog

- Add admin runtime usage charts and provider health diagnostics
- Add secure rotation flow for provider credentials and secret provenance
- Deepen queue ownership rules and SLA indicators
- Add outbound delivery/state webhook coverage for real Meta providers once credentials are available
- Add richer confirmation UX for destructive AI tools in `admin_internal`

## In Progress

- Expand `data-testid` coverage for inbox/conversation/channel filters
- Connect remaining generic AI action paths to richer conversational prompts and confirmation flows

## Done

- Added conversation hub foundation with Prisma `Conversation*`
- Implemented webchat session/message flow
- Implemented operator takeover/release/assign/reply
- Added AI service runtime with provider abstraction and Redis memory support
- Added channel adapter normalization for webchat/email/meta
- Added storefront webchat widget and admin conversations view
- Fixed dev CORS for `127.0.0.1` storefront/Playwright access
- Refactored CRM conversations into a mail-style multichannel inbox layout
- Implemented reusable backend `ai` action catalog and generic endpoints
- Added admin AI runtime settings UI with secure config persistence, usage messaging and near-limit warnings
- Added E2E coverage for AI settings, conversations, conversation actions and storefront webchat
- Projected inbound email and Meta traffic into the canonical conversation hub
- Connected `ai-agent-service` to backend `/api/ai/*` tools with backend-enforced validation
- Added durable `ConversationToolCall` persistence linked to agent replies
- Hydrated persisted transcript history into storefront webchat sessions
- Improved admin inbox for mobile usage with filters/list/detail pane switching
- Added queue filtering and real operator selector in conversations admin UI
- Added multichannel inbox E2E coverage for projected email conversations
- Fixed mobile detail pane scroll/visibility in CRM conversations
- Added visible delivery/provider badges to conversation messages
- Connected email replies from the unified hub to real outbound sending through `InboxService`
- Added Meta outbound dispatch contract plus canonical delivery-status sync endpoint
- Added admin-internal conversation creation and AI response loop in the unified inbox
- Added E2E coverage for mobile detail, outbound email reply and admin internal AI chat
