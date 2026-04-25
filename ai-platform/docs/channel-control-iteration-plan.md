# Channel Control Iteration Plan

Date: 2026-04-25

This document is the reference baseline for each migration iteration related to channel control.

## Objective

Move channel configuration ownership into `ai-platform` without destabilizing the current chat runtime.

## Working Rules

- `ai-platform` chat runtime is the canonical chat implementation.
- ecommerce and admin-facing applications may expose chat/channel UI, but state ownership and behavior remain in `ai-platform`.
- Legacy chat code is reference-only.
- Legacy channel runtime/orchestration code is deletion-target code.
- Every iteration must move callers toward standardized `ai-platform` channel contracts.
- UI channel settings contracts live under `/settings/channels`.
- Raw admin channel-control contracts live under `/admin/channel-control`.
- Adapter contracts live under `/internal/channel-control`.
- Legacy `settings/email/*` routes are not channel standards and must not be recreated in `ai-platform`.
- Email inbox transport config belongs to `ChannelControl`; ecommerce transactional email delivery remains outside `ChannelControl`.
- Channel secrets are stored through refs (`local` for local/dev, `env` for environment-backed deployments), not directly in the versioned channel-control resource.

## Iteration Checklist

Each iteration must answer:

1. What config domain is being migrated:
   - Meta
   - WhatsApp QR
   - Email
   - Webchat
   - Shared routing
2. What new `ai-platform` contract is introduced
3. Which legacy caller is redirected
4. Which deletion precondition is now satisfied
5. Which runtime paths remain intentionally untouched

## Execution Waves

### Wave 1. Config Model Baseline

- create `ChannelControl` resource model in `ai-platform`
- persist it as managed/versioned config
- expose read/update APIs
- no runtime wiring changes

Acceptance:
- config can be stored and retrieved in `ai-platform`
- no core chat module changes required

### Wave 2. Legacy Config Parity

- port Meta and WhatsApp QR config semantics
- port email inbox transport config semantics
- port shared routing defaults
- document any legacy-only fields kept as transitional metadata
- leave transactional email delivery config, templates, rules, logs, metrics, categories, and test-send outside `ChannelControl`

Acceptance:
- every field in the extraction matrix has a mapped target location
- every email endpoint is classified as either channel inbox config or ecommerce delivery/notifications

### Wave 3. UI Consumption

- ecommerce UI reads/writes `ai-platform` channel-control APIs
- no new UI writes to legacy channel endpoints
- channel settings screens use `/settings/channels/*`
- raw config editors use `/admin/channel-control/*`

Acceptance:
- all active UI paths use `ai-platform`
- no active UI path uses legacy `settings/email/inbox-config` for channel-owned email config

### Wave 4. Adapter Consumption

- `channel-adapter` reads config from `ai-platform`
- adapter no longer depends on legacy backend for channel config

Acceptance:
- legacy config endpoints are no longer required for transport runtime

### Wave 5. Legacy Runtime Deletion

- remove `backend/src/channels/meta/*`
- remove `backend/src/channels/whatsapp-qr/*`
- remove legacy channel-related orchestration paths no longer used by chat

Acceptance:
- no traffic reaches deleted endpoints
- no imports or compose dependencies remain

## Change-Control Guardrails

- no edits to `ai-platform` decision/interpretation/response core unless directly required by a channel-control contract
- no new feature logic added to legacy channel modules
- no dual ownership of config
- no deletion before caller cutover is verified

## Validation Per Iteration

- backend build
- contract-level tests for new config APIs
- regression smoke on existing `ai-platform` chat endpoints
- migration note appended to:
  - [progress.md](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/docs/progress.md)

## Documentation To Keep Updated

- this file
- [channel-control-extraction-matrix.md](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/docs/channel-control-extraction-matrix.md)
- [architecture.md](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/docs/architecture.md)
- [progress.md](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/docs/progress.md)
