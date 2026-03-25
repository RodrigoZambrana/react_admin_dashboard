# Tasks

## Backlog

- Expand conversation hub projections for email/meta/admin chat
- Add richer operator assignment selector and queue ownership
- Add generic AI business tools beyond the initial reusable action layer
- Hydrate historical transcripts into storefront webchat
- Add cross-project E2E for unified inbox filters and reply flows
- Add durable tool-call audit persistence for AI actions
- Add admin runtime usage charts and provider health diagnostics
- Add secure rotation flow for provider credentials and secret provenance

## In Progress

- Expand `data-testid` coverage for inbox/conversation/channel filters
- Connect generic AI action tools from `ai-agent-service` to backend `ai` endpoints
- Project email and Meta channel traffic into the canonical conversation hub

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
