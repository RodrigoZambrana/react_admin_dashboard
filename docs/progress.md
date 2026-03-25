# Progress

## Current Status

The repository is on branch `codex-ai-agent-foundation`.

Commerce, admin and QA baselines were already hardened before the current AI slice.

The AI foundation now includes:

- canonical conversation persistence in backend
- operator takeover/release/reply flow
- independent AI runtime service
- independent channel adapter
- storefront webchat runtime widget
- admin conversations inbox view
- admin AI runtime settings UI with secure configuration storage
- Redis-enabled AI runtime overlay in Docker

## This Iteration Focus

- formalize the repo-level docs required for autonomous iteration
- evolve conversations into a CRM inbox layout with channel selection
- introduce a reusable backend AI action layer for cross-tenant operations
- expose admin-manageable AI runtime configuration and warnings
- validate the new operator and storefront flows with browser regression coverage

## Risks Being Managed

- duplication between `Inbox*` and `Conversation*`
- regression risk in CRM operational surfaces
- channel/UI divergence between email inbox and conversation inbox
- configuration drift between backend secure config and AI runtime service instances

## Next Steps

1. Project email and Meta traffic into the canonical conversation hub
2. Connect `ai-agent-service` tools to backend `ai` endpoints for real action execution
3. Expand admin inbox ownership/queue controls and diagnostics
4. Add broader cross-project E2E around unified inbox filters and reply workflows
