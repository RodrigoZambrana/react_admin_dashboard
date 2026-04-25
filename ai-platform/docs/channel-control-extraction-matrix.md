# Channel Control Extraction Matrix

Date: 2026-04-25

Scope:
- Source analyzed:
  - `/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/channels`
  - `/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/inbox`
  - `/Users/rodrigo/Git/personal/react_admin_dashboard/backend/prisma/schema.prisma`
  - `/Users/rodrigo/Git/personal/react_admin_dashboard/services/channel-adapter/src`
- Target:
  - `/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform`

## Target Rule

- `ai-platform` owns chat runtime and channel control.
- ecommerce and admin surfaces may expose chat/channel UI, but they do not own chat/channel state; they consume `ai-platform` APIs.
- Legacy channel runtime/orchestration is deletion-target code.
- Legacy channel configuration semantics are migration input and must be reimplemented in `ai-platform`.

## Domain Split

### Must move to `ai-platform`

- channel configuration
- channel routing and inbox mapping
- provider credential references
- runtime behavior toggles
- channel operational policy
- connection/session state projections

### Must remain in ecommerce / business delivery

- transactional notification templates
- role-based notification rules
- notification categories and recipient policies
- transactional test-send flows
- delivery logs and metrics for ecommerce notifications
- provider configuration used only for ecommerce email delivery

### Must stay out of `ai-platform` core chat runtime

- legacy channel orchestration loops
- legacy adapter sync logic as a source of truth
- legacy inbox-driven conversation ownership

### May remain as temporary reference only

- secure config key names
- current field sets and defaults
- inbox-account mutation behavior
- queue inference rules

## Legacy Inventory Matrix

| Legacy source | Current responsibility | Current storage | Key fields / behavior | Target in `ai-platform` | Migration note | Legacy deletion trigger |
| --- | --- | --- | --- | --- | --- | --- |
| `backend/src/channels/meta/meta.service.ts` | Meta config control, adapter sync, inbox account consistency | secure config key `meta_channel_config` + `InboxAccount.metadata` + env fallback | `enabled`, `messengerEnabled`, `instagramEnabled`, `publicBaseUrl`, `pageId`, `instagramBusinessAccountId`, `appId`, `verifyToken`, `appSecret`, `pageAccessToken`, `messengerPageAccessToken`, `instagramAccessToken`, readiness flags | `ChannelControl.meta` resource + future connection-state projection | Reimplement config model first; do not port adapter orchestration | after adapter reads config from `ai-platform` and no callers hit `/settings/channels/meta` |
| `backend/src/channels/meta/meta.controller.ts` | admin CRUD for Meta config | HTTP | `GET/PUT/sync` | `ai-platform` admin channel-control endpoints | Replace ecommerce/admin callers with new endpoints | after UI stops calling legacy endpoint |
| `backend/src/channels/whatsapp-qr/whatsapp-qr.service.ts` | WhatsApp QR config, session control, backfill initiation, inbox account sync | secure config key `whatsapp_qr_channel_config` + `InboxAccount` + adapter state | `enabled`, `displayName`, `address`, `autoStart`, typing/presence/human-delay toggles, rate limits, quiet hours, proactive outbound, connected phone/session state | `ChannelControl.whatsappQr` config + future `ChannelConnectionState` | Split config from session actions; session control becomes transport-plane API later | after config/session APIs exist in `ai-platform` and runtime no longer depends on legacy endpoint |
| `backend/src/channels/whatsapp-qr/whatsapp-qr.controller.ts` | admin CRUD/session actions for WhatsApp QR | HTTP | `GET/PUT/start/stop/reconnect/reset/sync/backfill` | `ai-platform` admin channel-control endpoints + future adapter ops API | First migrate config endpoints, then session ops | after `ai-platform` owns both config and adapter command path |
| `backend/src/inbox/providers/email/email-channel.adapter.ts` | email channel config loading, IMAP/SMTP polling/sending behavior | secure config key `inbox.email.config` + env fallback | IMAP/SMTP host/port/security, username, password, fromAddress/fromName, size/rate limits, polling interval/batch | `ChannelControl.email` config + future connection-state projection | Extract config semantics only; do not carry polling loop into chat core | after channel gateway or dedicated email transport resolves config from `ai-platform` |
| `backend/src/inbox/providers/email/email-channel.config.ts` | env/secure-config merge and defaults | env + secure config | fallback logic for IMAP/SMTP defaults and limits | `ChannelControl.email` schema + seed defaults | Reuse defaults semantically, not code | after `ai-platform` schema is authoritative |
| `backend/src/inbox/inbox.service.ts` | inbox account listing, mailboxes, send/sync, queue application, polling loop | `InboxAccount`, `InboxMessage`, `InboxQueue`, `InboxSyncState` | operational inbox behavior, queue header mapping, default queue, email-account bootstrap | split between `ChannelControl` and chat operator inbox | Do not port polling/send runtime wholesale; only extract config and route semantics | after inbox read/write no longer required for chat migration path |
| `backend/src/inbox/common/queue-classifier.ts` | queue routing rules | env + code | `headerKey`, `defaultQueue`, rule matching | `ChannelControl.routingDefaults` and future rule set | Re-model as explicit routing policy | after chat routing uses `ai-platform` config projection |
| `backend/prisma/schema.prisma` `InboxAccount` | channel account identity and activation | Postgres | `channel`, `address`, `displayName`, `active`, `metadata` | `ChannelBinding` / `ChannelConnectionState` projection in `ai-platform` | Migrate semantic meaning, not shared table | after no runtime dependency remains |
| `backend/prisma/schema.prisma` `InboxQueue` + `InboxQueueUserAssignment` | queue configuration and operator assignment | Postgres | `slug`, `name`, `priority`, `slaTargetMinutes`, `assignmentMode`, capacity | chat-side operator routing domain, fed by channel routing config | Keep as separate bounded context in chat-platform, not in ecommerce | not part of initial delete; only after inbox/operator migration is complete |
| `services/channel-adapter/src/channels/meta/*` | Meta webhook/outbound transport | adapter runtime | webhook validation, send API, status/config reads | future transport-plane consumer of `ai-platform` ChannelControl API | Keep transport semantics, replace legacy backend client | after adapter target flips to `ai-platform` |
| `services/channel-adapter/src/channels/whatsapp-qr/*` | WhatsApp QR transport/session runtime | adapter runtime | QR session, outbound, history/backfill hooks | future transport-plane consumer of `ai-platform` ChannelControl API | Keep transport-plane responsibilities only | after adapter target flips to `ai-platform` |
| `services/channel-adapter/src/channels/webchat/webchat.adapter.js` | webchat ingress buffering/coalescing | adapter runtime | conversation handoff to legacy backend/ai agent | likely absorbed by `ai-platform` async intake/public chat APIs | New integration should be additive and explicit | after ecommerce uses `ai-platform` webchat APIs only |
| `services/channel-adapter/src/clients/ai-platform-conversations.client.js` | talks to `ai-platform` conversation bridge | HTTP client | bootstrap/inbound/outbound status | `ai-platform` internal conversation bridge | Replaces the former legacy backend conversation client | complete when no adapter path hits legacy backend |

## Endpoint Ownership Matrix

These rows are the ownership source for deciding whether a legacy endpoint remains in ecommerce, moves to `ai-platform`, or must not be mixed into `ChannelControl`.

| Legacy endpoint / caller | Current owner | Domain classification | Target owner | Target contract | Notes |
| --- | --- | --- | --- | --- | --- |
| `GET /settings/channels/meta` | legacy backend, formerly `backend/src/channels/meta` | conversational channel control | `ai-platform` | standard UI API `GET /settings/channels/meta`; raw config API `GET /admin/channel-control` | Returns screen-ready Meta channel config and observed status from `ChannelControl`. |
| `PUT /settings/channels/meta` | legacy backend, formerly `backend/src/channels/meta` | conversational channel control | `ai-platform` | standard UI API `PUT /settings/channels/meta`; raw config API `PUT /admin/channel-control/meta` | Writes update `ChannelControl.meta`. |
| `POST /settings/channels/meta/sync` | legacy backend, formerly `backend/src/channels/meta` | channel operational status | `ai-platform` + adapter | standard UI operation `POST /settings/channels/meta/sync` | Reads adapter status; does not make legacy backend authoritative. |
| `GET /settings/channels/whatsapp-qr` | legacy backend, formerly `backend/src/channels/whatsapp-qr` | conversational channel control | `ai-platform` | standard UI API `GET /settings/channels/whatsapp-qr`; raw config API `GET /admin/channel-control` | Returns desired config and observed state from `ChannelControl`. |
| `PUT /settings/channels/whatsapp-qr` | legacy backend, formerly `backend/src/channels/whatsapp-qr` | conversational channel control | `ai-platform` | standard UI API `PUT /settings/channels/whatsapp-qr`; raw config API `PUT /admin/channel-control/whatsapp-qr` | Writes update `ChannelControl.whatsappQr`. |
| `POST /settings/channels/whatsapp-qr/session/*` | legacy backend, formerly `backend/src/channels/whatsapp-qr` | channel adapter operation | `ai-platform` + `channel-adapter` | standard UI operation under `/settings/channels/whatsapp-qr/session/*` | Operational command, not config ownership. |
| `POST /settings/channels/whatsapp-qr/backfill` | legacy backend, formerly `backend/src/channels/whatsapp-qr` | channel adapter operation / migration support | `ai-platform` + `channel-adapter` | standard UI operation `POST /settings/channels/whatsapp-qr/backfill` | Keep out of chat core. |
| `GET /settings/email/inbox-config` | legacy backend `EmailAdminController` | conversational email channel config | `ai-platform` | replaced by standard UI API `GET /settings/channels/email`; raw config API `GET /admin/channel-control` | Do not expose this route from `ai-platform`. Legacy route remains only in legacy backend until callers are removed. |
| `PUT /settings/email/inbox-config` | legacy backend `EmailAdminController` | conversational email channel config | `ai-platform` | replaced by standard UI API `PUT /settings/channels/email`; raw config API `PUT /admin/channel-control/email` | Writes must go through `ChannelControl.email`. |
| `GET /settings/email/config` | legacy backend `EmailAdminController` | ecommerce email delivery control | ecommerce / delivery module | stay on legacy until extracted to a delivery-control module | Do not move into `ChannelControl`. |
| `PUT /settings/email/config` | legacy backend `EmailAdminController` | ecommerce email delivery control | ecommerce / delivery module | stay on legacy until extracted to a delivery-control module | Provider config for transactional/business delivery, not conversational channel config. |
| `POST /settings/email/config/test` | legacy backend `EmailAdminController` | ecommerce delivery operation | ecommerce / delivery module | stay on legacy until extracted to a delivery-control module | Test-send exercises transactional delivery. |
| `GET /settings/email/categories` | legacy backend `EmailAdminController` | ecommerce notification policy | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Notification category settings are not channel config. |
| `PUT /settings/email/categories/:category` | legacy backend `EmailAdminController` | ecommerce notification policy | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Recipient policy by category. |
| `GET/POST/PUT/DELETE /settings/email/rules*` | legacy backend `EmailAdminController` | ecommerce notification policy | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Role routing for notifications, not chat routing. |
| `GET /settings/email/logs` | legacy backend `EmailAdminController` | ecommerce delivery observability | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Only channel connection logs belong in channels. |
| `GET /settings/email/templates*` | legacy backend `EmailAdminController` | ecommerce notification content | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Templates are business message content. |
| `POST /settings/email/templates/:id/preview` | legacy backend `EmailAdminController` | ecommerce notification content operation | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Template preview is not a channel operation. |
| `GET /settings/email/metrics` | legacy backend `EmailAdminController` | ecommerce delivery observability | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Delivery metrics are not channel connection metrics. |
| `POST /email/test` | legacy backend `EmailController` | ecommerce delivery operation | ecommerce / delivery module | stay on legacy until extracted to notifications/delivery | Separate from inbox-channel connectivity tests. |
| `/notifications*` and storefront notification endpoints | legacy backend notifications module | ecommerce notification consumption | ecommerce / notifications module | stay in ecommerce domain | Notification inbox is not chat inbox. |

## Channel API Standard

The standard channel-control contracts are:

- UI settings contract: `GET /settings/channels/:channel`, `PUT /settings/channels/:channel`
- UI channel operations: `POST /settings/channels/:channel/*`
- raw admin desired-state contract: `GET /admin/channel-control`, `PUT /admin/channel-control/:channel`
- adapter read contract: `GET /internal/channel-control`, `GET /internal/channel-control/channels/:channelKey`
- adapter observed-state contract: `PUT /internal/channel-control/channels/:channelKey/connection-state`

The `settings/channels/*` endpoints are the standard UI-facing channel settings API:

- `/settings/channels/meta`
- `/settings/channels/whatsapp-qr`
- `/settings/channels/email`

`/settings/email/inbox-config` is not part of the `ai-platform` channel API. It is a legacy backend endpoint that must be retired from callers in favor of `/settings/channels/email`.

## Prisma Ownership Mapping

### Legacy models used as source reference

- `InboxAccount`
- `InboxMessage`
- `InboxSyncState`
- `InboxQueue`
- `InboxQueueUserAssignment`
- `EmailSetting`
- `EmailTemplate`
- `RoleNotificationRule`
- `EmailLog`
- `Notification`
- `NotificationSetting`

### Legacy models that map to `ChannelControl`

- `InboxAccount`: channel account identity and activation, only where it represents a conversational channel.
- `InboxSyncState`: observed sync state, mapped to connection-state projection where relevant.
- secure config key `inbox.email.config`: email inbox transport config, mapped to `ChannelControl.email`.
- channel secrets: migrated to `ChannelSecret` local refs or env refs, not embedded in the versioned `channel_control` resource.

### Legacy models that must not map to `ChannelControl`

- `EmailSetting`: ecommerce notification category policy.
- `EmailTemplate`: transactional/business notification content.
- `RoleNotificationRule`: ecommerce recipient routing policy.
- `EmailLog`: delivery log for business notifications.
- `Notification` and `NotificationSetting`: ecommerce notification consumption and preferences.

### Target ownership in `ai-platform`

- `ChannelControl` managed config
  - desired config
  - provider references
  - routing defaults
- future `ChannelConnectionState`
  - observed readiness
  - session state
  - linked account identity
- existing chat runtime models stay in `ai-platform`
  - `Conversation`
  - `Message`
  - `ConversationState`

## Required Config Domains To Reimplement

### Meta

- activation flags
- messenger / instagram sub-channel toggles
- public base URL and webhook-facing metadata
- page/business identifiers
- credential references:
  - verify token
  - app secret
  - page access token
  - messenger page token
  - instagram access token
- routing defaults:
  - inbox key
  - queue key
  - scope

### WhatsApp QR

- activation
- channel identity
- session startup policy
- typing/presence/humanized-delay behavior
- delivery rate limits
- proactive outbound policy
- quiet hours
- routing defaults

### Email

- activation
- account identity
- IMAP/SMTP endpoints
- security modes
- credential references
- default sender identity
- attachment/rate limits
- polling settings
- routing defaults

### Webchat

- activation
- anonymous/authenticated enablement
- locale/currency defaults
- typing/coalescing defaults
- routing defaults

## Deletion Order Constraints

1. Recreate config schema in `ai-platform`
2. Expose CRUD/read APIs in `ai-platform`
3. Migrate UI callers
4. Move adapter config reads to `ai-platform`
5. Stop inbound traffic to legacy chat/channel endpoints
6. Delete legacy channel runtime/orchestration code
7. Delete leftover legacy config code

## Non-Negotiable Invariants

- no shared DB between ecommerce and `ai-platform`
- no dual write of channel config
- no direct use of legacy chat runtime in the target state
- no modification of `ai-platform` core chat flow as part of this migration slice
