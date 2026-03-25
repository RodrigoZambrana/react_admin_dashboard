# Progress

## Current Status

The repository is on branch `codex-ai-agent-foundation`.

Commerce, admin and QA baselines were already hardened before the current AI slice.

The AI foundation now includes:

- canonical conversation persistence in backend
- grouped conversation persistence across webchat and projected email/meta inbound flows
- operator takeover/release/reply flow
- independent AI runtime service
- independent channel adapter
- storefront webchat runtime widget
- admin conversations inbox view
- admin AI runtime settings UI with secure configuration storage
- Redis-enabled AI runtime overlay in Docker
- durable tool-call audit linked to conversation replies
- mobile-first inbox behavior for admin conversations
- real outbound email replies from the unified conversation hub
- delivery/provider status persisted and exposed in conversation detail
- admin-internal chat creation and AI response loop from the same inbox UI

## This Iteration Focus

- stabilize the critical mobile conversation detail experience
- connect unified-hub replies to real outbound transport where possible
- extend the inbox to cover `admin_internal` conversations in the same UI/runtime
- keep documenting the unified knowledge base for future iterations

## Risks Being Managed

- duplication between `Inbox*` and `Conversation*`
- regression risk in CRM operational surfaces
- channel/UI divergence between email inbox and conversation inbox
- configuration drift between backend secure config and AI runtime service instances
- provider-specific delivery coverage for Meta channels still depends on credentials/webhooks not yet available in this environment

## Next Steps

1. Expand conversational prompts and confirmation flows for the backend AI tools
2. Add richer ownership, SLA and queue diagnostics in the admin inbox
3. Extend cross-project E2E around unified inbox filters, reply workflows and operator handoff
4. Add provider-backed outbound/status sync for real Meta credentials and delivery webhooks
