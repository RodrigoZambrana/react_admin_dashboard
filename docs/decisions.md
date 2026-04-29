# Architectural Decisions

## Active Decisions

### Critical maintenance scripts are local-only and explicitly confirmed

- `prepare-regression-state`, `reset-admin` and `bootstrap-fresh-local-db` must remain CLI-only maintenance paths, never HTTP-triggerable flows.
- Destructive execution is blocked in `production / prod / live` environments.
- Destructive execution requires explicit confirmation instead of relying on script names.
- Cleanup entrypoints should default to `dry-run`; destructive apply should be a separate explicit command.
- Non-local database targets are blocked by default unless a deliberate non-production override is set.
- Reason: avoid accidental or hostile data loss through maintenance tooling, especially during test/prod convergence.

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

### External messaging templates are reference inputs, not runtime dependencies

- The external `dreamschat-v2.8.4` project should not be imported directly into `frontend` or `ecommerce`
- It may be used as a reference for messaging shell patterns, mobile pane behavior and settings grouping
- The current repo should instead define internal shared messaging primitives that fit the existing admin and storefront stacks
- Reason: the external template is a full Vite/Bootstrap/React Router application and would introduce routing, CSS and maintenance conflicts if embedded directly

### Inbox experiences are mobile-first

- Conversation inbox surfaces must remain fully usable on mobile devices
- Filters, list and detail panes should be accessible through responsive pane switching inspired by mature chat/mail products
- Reason: the primary operational usage is expected on mobile devices

### Generic AI actions must be backend-driven

- Generic action endpoints live in `backend/src/ai`
- AI services call backend contracts, never the database
- Reason: reusable SaaS-safe action layer and centralized validation/permissions

### User capability management is backend-policy driven

- The `Users` ABM and capability editing are governed by backend-configurable role sets
- Those role sets resolve as `database -> environment fallback`
- Frontend may expose compatible admin routes, but backend remains the source of truth
- A profile may have:
  - no access to the user ABM
  - access to user management but not to capability management
  - full access to both
- Reason: preserve flexibility for different companies without hardcoding one rigid admin model in UI or prompt logic

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

### Threading, ordering and pagination must converge across inbox surfaces

- `Conversations` is the behavioral reference model for thread identity and `lastMessageAt` ordering
- `Emails` may remain a channel-specific operator surface, but it must converge to the same rules for:
  - thread identity priority
  - revived-thread ordering
  - historical pagination
  - sync completeness visibility
- Shared messaging primitives in admin and storefront must follow the same contract
- Reason: avoid operational drift where the same conversation behaves differently depending on which surface or channel the operator uses

### Minimum endpoint protections are mandatory across the whole system

- Authentication, authorization, role/scope checks, rate limiting and origin restrictions must be audited for every externally reachable endpoint
- This requirement applies to:
  - admin endpoints
  - storefront endpoints
  - backend operational endpoints
  - AI runtime/internal integration endpoints
  - channel and webhook endpoints
- Existing global mechanisms reduce risk, but they do not replace an explicit endpoint-by-endpoint audit
- Reason: channel growth increases external exposure, and protection gaps in any module can undermine the whole platform
- Tracking artifact:
  - `docs/endpoint-protection-audit-matrix.md` is the canonical audit matrix for status by module and endpoint group

### Analytics configuration stays separate from analytics operation

- `Growth & Insights` remains the configuration surface for tracking, pixels and measurement settings
- `Analytics` is the operational surface for connections, sync runs, reporting and insights
- The two surfaces must remain linked in navigation but separated in responsibility
- Reason: avoid mixing measurement setup with business consumption, and keep the admin mental model stable as connectors grow

### Admin login is local product authentication, not Google authentication

- The admin session on `localhost:8080` is handled by the local app auth flow (`/sign-in`, `/auth/session`, cookies)
- The Google account `desarrollo@software-strategy.com` is an admin user in the local database, not a Google OAuth requirement for the admin panel
- Google is only used for external connector OAuth flows inside `AnalyticsModule`
- Reason: prevent mental-model drift between product authentication and external source integration

### GA4 is the first operational connector in this slice

- Google Analytics 4 is the first source to operationalize in this iteration
- Reason: the current dashboard slice prioritizes behavior, onsite funnel validation and session-level attribution
- Google Ads and Search Console stay planned but deferred until GA4 proves the end-to-end flow
- The local Google export folder is reference material only; it is not an ingestion source

### Google Ads enters after GA4 because the environment already supports read-only reporting

- Google Ads was added as the second operational connector in this slice because the local backend environment already provides the OAuth, developer token and customer ID required to run reporting-only syncs
- The connector is intentionally read-only: it reads campaign performance but does not mutate bids, budgets or creatives
- Reason: once GA4 proves the session and funnel contract, Ads gives immediate CAC / ROAS visibility with the least additional surface area
- Search Console is the third operational connector and now follows the same read-only reporting pattern once a property is selected

### Search Console is the third operational connector and follows the same backend-only contract

- Search Console sync now uses the same backend OAuth / token storage / incremental sync pattern as GA4 and Ads
- The connector reads query, page, clicks, impressions, CTR and position only; it does not mutate site settings
- Reason: SEO and demand organic visibility complete the first operational triad without mixing it with tracking configuration

### Analytics sync runs automatically by source when a connection is due

- A lightweight backend scheduler checks due `analytics_connections` and triggers incremental sync for GA4, Ads and Search Console
- Manual sync, backfill and repair remain available, but the normal steady state is automatic incremental refresh
- Reason: keep the system productive without relying on operator-triggered refresh loops

### Analytics connectors live in `AnalyticsModule`

- OAuth, secure credential storage, property selection, sync runs and reporting belong to `AnalyticsModule`
- `GrowthModule` must not absorb connector logic
- Reason: isolate external source integration from tracking configuration and preserve a clean path toward a standalone analytics service later

### IA consumes normalized metrics and evidence, not raw events

- Generative analysis must sit on top of reporting tables, insights and context
- Raw event JSON is allowed for ingestion and normalization only
- Reason: make explanations auditable and keep the model from reasoning on unstable event payloads

### AI insights are derived from explicit period comparisons

- The insights layer compares a current period against a previous period of the same size
- Inputs come from `analytics_reporting_daily`, `analytics_report_reconciliations`, `analytics_report_runs`, `analytics_connections`, `analytics_sync_runs`, `analytics_baseline_snapshots`, and `analytics_data_quality_checks`
- Deterministic rules fire before any generative explanation
- Evidence, source report and period range must be stored with every insight snapshot
- Reason: keep insight generation explainable, reproducible and resistant to noisy event payloads

### Analytics insights keep an explicit history table

- Current operational insights can be recomputed, but every recompute must also append to `analytics_insights_history`
- `analytics_insights_history` stores date, insight type, title, description, impact, recommendation, confidence, evidence, source report, period range, score and optional summary text
- The history table is the source for auditability and trend review; the operational bundle is the source for the UI
- Reason: insights are derived data and must be traceable across syncs, reconciliations and baseline corrections

### Frontend never receives tokens

- OAuth tokens, refresh tokens and secret material remain backend-only
- The UI may receive connection status, readiness, sync timing and target metadata
- Reason: reduce exposure and keep credential handling centralised and auditable

### GA4 reporting must separate business purchases from GA4 proxies

- `analytics_reporting_daily.ga4_purchase_proxy` is the explicit GA4 conversion proxy
- `purchase` remains reserved for consolidated business purchase semantics
- Reason: prevent accidental interpretation of GA4 key events as real ecommerce revenue or orders

### GA4 parity uses offline baseline as reference, not as runtime input

- The exported Google report (`Informe_panoramico.csv`) is reference material only
- The canonical baseline for future data-quality checks is a reproducible GA4 API query, not the UI export
- Runtime syncs always come from the GA4 API and are persisted independently of the CSV
- Reason: keep the operational system API-driven while still being able to prove coverage and deltas against a reproducible baseline

### Baseline snapshots and data quality are the canonical parity layer

- `analytics_baseline_snapshots` stores reproducible GA4 API snapshots keyed by query hash
- `analytics_data_quality_checks` stores deterministic comparisons between baseline snapshots and synced rows
- CSV parity remains a reference-only aid; it is no longer the operational truth source
- Reason: parity must converge from exploratory comparison into auditable, repeatable data quality

### GA4 report reconciliation must be explicit about partial overlap

- Report reconciliation states are:
  - `aligned` only when every comparable row and metric matches
  - `partial` when there is overlap but values or rows diverge
  - `gap` when the comparison is not meaningfully aligned
  - `missing` when no baseline exists
- Reason: avoid overstating parity when only a subset of rows or metrics match

### Daily GA4 report parity is normalized by day offset, not by raw row order

- Daily report rows are compared using a day-offset key derived from the sync range start
- Reason: GA4 API returns aggregated rows in a different order than the exported baseline, so row order alone is not a stable reconciliation key

### CSV parity is transitional until API baseline snapshots exist

- The current CSV-based report parity layer remains a transitional reference implementation
- The canonical layer is now `analytics_baseline_snapshots` plus `analytics_data_quality_checks`
- Reason: align the repo with the reproducible-baseline design where the GA API is the truth source and the UI export is only a secondary sanity check

### Parity sync stays backend-only

- The frontend only triggers backend operations and reads status
- The backend owns OAuth, token storage, report sync and reconciliation
- Reason: preserve the no-secrets-in-browser rule and keep connector validation programmatic

### Google Ads conversion value is not business revenue

- `analytics_ads_daily_metrics.conversion_value` stores the value reported by Google Ads
- It is a platform metric, not a consolidated business revenue number
- Reason: keep CAC / ROAS math auditable and avoid mixing attribution value with booked ecommerce revenue

### GA4 sync lifecycle includes incremental, backfill and repair

- Initial sync is only the first operational step
- Incremental sync must overlap recent history to catch late GA4 updates
- Backfill and repair are manual maintenance modes and must remain traceable in sync runs
- Reason: GA4 data can arrive late or need reprocessing without mutating the raw ingestion contract

### Unified inbox replies must preserve transport traceability

- Email replies sent from `conversations` must still persist through `InboxMessage` / `InboxMessageEvent`
- Non-email channels may dispatch through `channel-adapter`, but status updates must be projected back into the canonical conversation hub
- Reason: operators need one source of truth for message history, provider status and handoff continuity

### `admin_internal` lives in the same hub, not in a separate UI

- Internal operator-to-AI chat is modeled as `Conversation(scope=ADMIN_INTERNAL, channel=ADMIN_CHAT)`
- The same CRM inbox surface is reused for customer and internal scopes, with scope-aware prompts and actions
- Reason: operators need one inbox mental model with immediate switching between customer attention and internal assistance

### AI knowledge must be tiered and curated

- Trusted AI knowledge is not a flat merge of docs, application data and raw conversations
- Source priority is: curated docs/business rules -> validated backend data -> curated admin-authored knowledge -> approved conversation-derived knowledge
- Raw customer or operator conversations must not become trusted retrieval input automatically
- Conversation-derived knowledge requires redaction, review and approval before promotion
- Reason: prevent contamination of the assistant with exceptions, hallucinations or PII-heavy content

### Local/internal knowledge documents must enter through the managed admin flow

- Tenant-specific internal documents are not treated as trusted knowledge just because they exist on disk in a developer machine or repo folder
- The production-like source of truth for local/internal documents is:
  - upload from admin AI settings
  - visible managed record in the UI
  - downloadable/openable source file
  - deletable and re-uploadable from the same UI
- Public website ingestion remains a separate source for customer-safe knowledge
- Reason: the same governance path must work in production and development, with explicit ABM over approved source documents instead of hidden filesystem shortcuts

### Curated tenant playbooks are first-class internal knowledge

- For tenants like `urucortinas`, internal AI quality should not rely only on raw uploaded reports or scraped website pages
- A curated internal document can summarize:
  - business lines
  - commercial rules
  - operating constraints
  - known risks
  - response guidelines
- That document must still enter through the same managed upload path as any other production document
- Reason: the model answers better when the business context is normalized into an operational playbook instead of depending only on generic report fragments

### Uploaded knowledge files require durable storage outside the backend container

- Source documents uploaded from AI settings are persisted under `backend/uploads/knowledge` and mounted into the backend container as `/app/uploads`
- The database stores only the managed metadata and relative file path; the file itself must survive container rebuilds
- Reason: without a host-mounted upload directory, managed documents become undeletable/undownloadable after container recreation even if the `KnowledgeDocument` row still exists

### Knowledge persistence starts before retrieval indexing

- The first production slice stores curated knowledge and candidate review directly in PostgreSQL
- Docs and safe backend datasets are ingested before any vector/RAG layer is introduced
- Reason: make knowledge governance, review and PII handling explicit before adding retrieval complexity

### Retrieval starts lexical and approval-only

- The first retrieval layer reads only `KnowledgeDocument` rows that are active and already approved
- It excludes raw conversation messages, pending candidates and unreviewed PII-heavy content by construction
- `admin_internal` can retrieve both approved internal and customer-public knowledge, while `customer_public` is restricted to approved customer-public knowledge
- Reason: improve answer quality early without introducing embeddings complexity or contaminating prompts with uncurated sources

### Vector retrieval is staged on top of approved knowledge only

- Embeddings are persisted in `KnowledgeDocumentEmbedding` and linked 1:1 to approved `KnowledgeDocument` records
- The current implementation uses a deterministic local embedding projection stored in PostgreSQL JSON for a low-friction baseline
- Reindexing is explicit and operator-triggered from admin while ingestion flows also index newly approved documents synchronously
- Raw messages, pending candidates and unreviewed PII-heavy content remain outside the vector corpus
- Reason: gain semantic retrieval benefits now without introducing pgvector or external embedding dependencies before governance is stable

### AI conversation QA runs serially at block level

- The `storefront-e2e-ai-conversations` QA block now runs with `--workers=1`
- Individual specs still execute normally in Playwright, but the consolidated QA block is serialized because those tests share canonical inbox state and provider simulators
- Reason: reduce false negatives from cross-test interference while preserving the same real runtime coverage

### Queue ownership is explicit and persisted

- Queue priority, SLA targets, assignment mode and operator capacity live in database models, not only in frontend configuration
- Least-loaded auto-assignment is allowed for inbound creation when a queue explicitly enables it
- Reason: ownership behavior must be auditable and consistent across backend, admin inbox and future automations

### Supervisor override is per-conversation and auditable

- Supervisors can reroute a conversation to a different queue and optionally reassign the operator from the conversation detail
- The override is persisted as a handoff/assignment event instead of existing only as transient UI state
- Reason: operational overrides must be explicit, reviewable and safe under mixed human/AI handling

### Confirmation guidance comes from the backend action catalog

- `admin_internal` confirmation prompts should be derived from the same backend catalog that defines generic AI actions
- Each action exposes required fields, keywords and confirmation guidance consumable by AI runtimes
- Reason: keep tool execution rules reusable and consistent across tenants, runtimes and future providers

### Internal AI CRUD should expand in safe operational stages

- The first `admin_internal` tool set now goes beyond create-only operations for the entities that have low-risk and clear backend contracts:
  - customer search/update
  - activity search/update/delete
  - product update/archive
- More sensitive lifecycle changes for quotes, orders and payments should come next as explicit state-change tools, not as unrestricted generic delete/update operations
- Reason: improve practical operator assistance without introducing high-risk destructive actions before the business rules are explicit enough

### Confirmable ABM operations should use one runtime lifecycle

- Confirmable internal ABM operations should not depend on ad hoc special cases per entity
- The common runtime pattern is now:
  - `draft`
  - `confirm`
  - `execute`
  - `verify`
  - `respond/debug`
- Drafts must be persisted in conversation memory so the second turn can execute against the previously prepared payload instead of re-inferring the whole action from scratch
- Verification links should only be returned when the entity still exists and there is a useful admin route to inspect the result
- `delete` and error flows must answer without dead detail links
- Reason: keep operational AI explainable, testable and consistent across entities instead of re-solving the same lifecycle in every new action

### Agent replies must persist human text separately from debug and audit

- The canonical conversation message body should store only the clean human-facing response (`finalUserText`)
- Debug details and richer audit payloads should be persisted in metadata / `aiState.audit`, not merged into the visible transcript body
- Admin/internal surfaces may render those debug and audit layers explicitly
- Customer/storefront surfaces must remain on the clean final text only
- Reason: preserve human-readable transcripts while still keeping development and operator traceability available

### Conversational closure now has priority over adding more isolated actions

- The next AI slices should prioritize closure quality for storefront/admin interaction before adding many new standalone actions
- Closure quality means:
  - human-like final wording
  - contextual continuity without contamination
  - coherent handoff to humans
  - multimodal understanding
  - stable inbox/storefront state projection
  - consistent `success / error / blocked / missing-data / handoff` semantics
- The canonical implementation reference for this phase is:
  - [AI_CONVERSATIONAL_CLOSURE_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_CLOSURE_PLAN.md)
- Reason: at the current maturity level, adding more isolated tools/actions would increase surface area faster than conversational reliability, making the stack feel less human and less trustworthy even if technical coverage grows

### Explicit confirmation detection must not collide with operational intents

- Expressions like `confirmar presupuesto ...` or `confirmar pedido ...` are action intents, not second-turn confirmations by themselves
- Runtime confirmation detection should only accept short, explicit approval turns such as `confirmo`, `sí confirmo`, `adelante`, `ejecuta`
- Reason: otherwise the runtime can skip the draft stage and execute or fall through incorrectly on requests that merely describe the desired operation

### Internal operational AI is role-scoped and must not leak into customer conversations

- CRUD, ABM, catalog mutations, quote/order/payment management and similar administrative flows only apply to internal conversations initiated from authenticated admin roles such as `admin` or `superadmin`
- `customer_public` must never offer, simulate or request the payload of those internal operations
- When a customer asks for an internal or administrative action, the assistant should answer politely that an advisor will continue the process by the appropriate channel
- Reason: customer-facing assistance can orient and inform, but must not expose or impersonate internal operational workflows

### Search-first should be enforced in runtime, not only suggested in prompts

- For `admin_internal`, certain actions now trigger deterministic pre-search in the AI runtime before the model answers:
  - customer resolution for quotes/orders
  - order resolution for payments
  - product resolution for updates and product-heavy order/quote requests
- The resulting backend hits are injected into the prompt as operational context and persisted as tool-call traceability in the conversation hub
- Reason: relying only on the LLM to decide whether to search first was not stable enough for production-like operator flows

### `Aberturas` must keep one master prompt contract aligned with live code

- The canonical written reference for `admin_internal` `aberturas` handling is now:
  - `docs/knowledge/aberturas-admin-internal-master-prompt.md`
- It must consolidate:
  - external ETL prompt rules
  - external parser/process survey
  - the consolidated `aberturas_enterprise` ETL project when available
  - approved internal tenant playbooks
  - current backend/frontend behavior actually implemented in the repo
- If those sources conflict, the order of truth is:
  - live code paths
  - schema/glossary artifacts
  - approved internal playbooks
  - external reference documents
- Reason: `aberturas` is now a high-impact operational flow and cannot rely on scattered prompt fragments that drift away from the code actually executing

### `Aberturas` parsing is now being extracted into a dedicated backend subsystem

- The first deterministic parsing slice has been moved out of `backend/src/ai/ai.service.ts` into `backend/src/aberturas/parser/*`
- `AiService` should consume that parser service, not keep growing structural parsing helpers again
- The parser roadmap must explicitly survey and unify the existing useful domain code already present in:
  - `backend/src/aberturas/*`
  - `backend/src/pricing/parametric-pricing.service.ts`
  - glossary/schema artifacts
  - current admin quote/product flows
- The next parser iterations should continue in that module and only leave prompt/runtime responsibilities in the AI layer
- Reason: domain parsing for `aberturas` is already complex enough that keeping it inside the AI service would keep mixing business parsing, tool orchestration and prompt concerns in one place

### AI runtime memory should be task-scoped, not only conversation-scoped

- The AI runtime now keeps a short-term working memory per task inside each conversation snapshot
- It detects strong intent/topic shifts and can reset the working memory without deleting the canonical conversation history
- `admin_internal` uses a stricter reset strategy to avoid contaminating one operational request with another
- customer scopes keep continuity for related follow-ups, but can also reset cleanly when the topic changes clearly
- `customer_authenticated` is now the preferred runtime name for the logged-in customer scope, although persistence and conversation enums still remain on the existing public/internal split for now
- Reason: conversational continuity is useful, but operational accuracy requires isolating unrelated tasks instead of always replaying the whole chat

### Conversation continuity and clean task resets are cross-system requirements

- Continuity, contextual memory, clean task resets, role-adapted wording and safe topic switching are expected capabilities of the whole AI-assisted messaging system
- These requirements do not belong only to `urucortinas`, `aberturas` or any single tenant/product flow
- Tenant-specific playbooks, products and knowledge sources can enrich the behavior, but the baseline conversational behavior must remain consistent across tenants
- Reason: the platform target is a reusable operational AI system, not a one-off assistant tuned only for a single client domain

### Logged-in customer behavior should use `customer_authenticated` as the canonical name

- The preferred name for logged-in customer behavior is now `customer_authenticated`
- The runtime already supports it as a first-class scope
- The persisted conversation layer now starts using it for authenticated webchat sessions instead of collapsing every customer-facing case into `customer_public`
- Retrieval and tool safety still map authenticated customer behavior to the same customer-safe policy set, not to internal admin capabilities
- Reason: the system needs to distinguish public anonymous attention from authenticated customer continuity without weakening the separation from internal/admin scopes

### `Aberturas` parsing should move into deterministic backend code

- The long-term target for `aberturas` is a dedicated backend parser subsystem that owns:
  - normalization
  - segmentation
  - contextual inheritance
  - validation
  - scoring
  - deduplication
  - insert/quote payload preparation
- The AI agent should keep only:
  - intent selection
  - confirmation handling
  - role-aware wording
- Reference document:
  - `docs/knowledge/aberturas-parser-backend-recommendation.md`
- Reason: domain rules for `aberturas` are already rich enough that keeping core structural parsing in prompts would be harder to test, maintain and govern than a deterministic backend implementation

## Assumptions

- The current tenant baseline is `urucortinas`
- The stack should remain reusable for future tenants
- Unified operator-human inbox is a phase 1 requirement, not a future enhancement

## Tradeoffs

- Short term there will be overlap between `Inbox*` and `Conversation*`
- This duplication is accepted temporarily to avoid destabilizing current email workflows while the unified hub matures
# 2026-03-25

## Inbox email config precedence

- Decision:
  - for inbox email runtime, persisted secure config in database is authoritative when present
  - environment variables are only bootstrap inputs when there is no stored config yet
- Reason:
  - operator-managed channel settings must be editable and effective without redeploying containers
  - env values should not silently override runtime configuration saved from admin
- Consequence:
  - limits and polling defaults still exist, but they resolve from fixed defaults when DB values are absent
  - blank env strings no longer degrade numeric config to `0`

## Shared messaging primitives

- Decision:
  - extract reusable messaging primitives into `frontend/src/components/messaging`
  - keep admin as the first full consumer
  - expose only a restricted subset later to storefront
- Reason:
  - the same messaging layout solves transcript, list/detail and mobile UX problems in both admin and storefront
  - permissions and data scope still differ, so reuse must happen at UI primitive level, not by sharing the whole feature module
- Consequence:
  - admin keeps operational panels, queues, SLA and tool controls outside the shared primitive core
  - storefront public chat and logged-in chat can later reuse the same visual base with different contracts

## Admin messaging closure should prioritize a basic operational result

- Decision:
  - before adding heavier operational layers like weighted routing, SLA escalation or richer ownership policies, the admin messaging slice should first close a basic working loop
  - that loop is:
    - mailbox synchronization
    - canonical grouping/threading
    - reading thread history
    - replying from the admin surface
- Reason:
  - exploratory testing is expected right after this closure, and overbuilding before real operator feedback would add risk and noise
- Consequence:
  - `ownership / routing / SLA` remains documented as recommended follow-up work
  - current implementation effort should stay focused on making the email inbox reliable and understandable end to end

## The new messaging template is now the dominant visual reference for admin chat

- Decision:
  - for the admin messaging closure, the external messaging template should drive the visual direction of transcript, shell and mobile behavior
  - reuse should still happen through our own React components inside the admin stack, not by embedding the external runtime directly
  - the HTML template is the visual source of truth for the chat layout; React reimplementation happens in-repo
- Reason:
  - the template already resolves the chat UX/UI problems that matter most for exploratory testing: transcript readability, visual hierarchy, mobile usability and message-type rendering
- Consequence:
  - incremental styling over the previous interim layout is no longer enough
  - exploratory testing should use the new visual language as the baseline, especially for text, attachment, image and audio messages

## Conversations migration runs with a parallel legacy route

- Decision:
  - the new template-driven conversations inbox is the primary route and destination for ongoing work
  - the pre-existing conversations implementation remains temporarily accessible as `Conversations V2`
- Reason:
  - migration needs side-by-side validation without destroying the currently working implementation
  - once the new route is accepted, the legacy version can be removed cleanly
- Consequence:
  - route and navigation naming may temporarily look inverted relative to the internal component history
  - all new visual and UX work should target the new primary route, not the legacy one

## Template assets must be copied into the current repo

- Decision:
  - CSS and media assets needed by the new messaging layout must live inside the current project
  - runtime rendering must not depend on reading files from the external `dreamschat-v2.8.4` workspace
- Reason:
  - the migrated inbox needs to be self-contained, testable and deployable
  - local copies also enable stable visual E2E coverage for image/audio/video/attachment rendering
- Consequence:
  - `frontend/public/mock/dreamschat` is now the local fixture source for chat media visualization and tests

## Read and pin state are now separated by operational scope

- Decision:
  - `read / unread` is persisted in backend per `conversationId + userId`
  - `pin` is persisted in backend as a shared conversation signal
- Reason:
  - read state has immediate multi-operator operational value
  - pinning is being used as an operational triage cue inside the shared admin inbox, so local-only storage is no longer sufficient
- Consequence:
  - operator read state stays real across reloads and operator sessions
  - pinned conversations are now expected to stay aligned for all operators using the same inbox

## Legacy Mail must converge into canonical conversation URLs

- Decision:
  - `/app/crm/mail` remains only as a compatibility surface while email threading converges
  - when a legacy email thread already belongs to a canonical conversation, navigation should resolve to `/app/crm/conversations/:conversationId`
- Reason:
  - the operator-facing system should not maintain two competing URL models for the same customer thread
- Consequence:
  - the old `?mail=` query-param flow becomes transitional
  - the conversation hub remains the target URL model for accepted operator work

## Message actions must be modeled before provider-specific rollout

- Decision:
  - reactions, favorites, attachment actions, edit/delete and similar message affordances must be introduced through the canonical conversation model first and only then mapped to provider capabilities
- Reason:
  - Meta, email and webchat do not support the same action surface and the UI should not expose actions that cannot be audited or projected back consistently
- Tracking artifact:
  - `docs/messaging-actions-roadmap.md`
## 2026-03-25 · AI runtime local y fallback de proveedor

- `needsHuman` no queda solo en `metadata`; también se persiste como campo explícito en `Conversation` para facilitar listados, filtros y auditoría operativa.
- El grounding detallado sigue viviendo en `metadata.aiState` porque ahí se guardan:
  - fuentes
  - score
  - provider/model
  - motivo de fallback
- Para el runtime local se habilita OpenAI desde archivos `.env.*.local` ignorados por git cuando no existe todavía configuración segura persistida en backend.
- Si el proveedor LLM devuelve error operativo o de cuota, el agente no debe fallar duro:
  - responde con fallback controlado
  - marca `needsHuman=true`
  - conserva el contexto de conocimiento recuperado para trazabilidad
- Redis queda confirmado como memoria operativa real del `ai-agent-service`; otras integraciones Redis del backend siguen siendo infraestructura disponible, pero no son parte del flujo IA mínimo validado en esta etapa.
- `2026-03-26`: los cambios de estado de presupuesto, pedido y pago para IA no deben implementar un flujo paralelo. Deben reutilizar el contrato de estados real del backend (`order-statuses`, `SalesDocumentsService` y `OrderPaymentSettlementService`) para evitar divergencias operativas.
- `2026-03-26`: el catalogo de acciones habilitadas para `admin_internal` debe ser visible en UI para auditoria operativa. No alcanza con que exista solo en runtime interno.
- `admin_internal` no debe depender de `tenantKey=default` para conversaciones internas locales: si el tenant no viene en la petición, la resolución debe usar `CLIENT_SLUG` para que retrieval y prompts operen sobre la knowledge aprobada del cliente activo.
- En `aberturas`, el prompt y el playbook deben priorizar el contrato del código vivo (`parametric-pricing.service`, glosario, selector summary y `AberturasQuote`) por encima de documentación estática más vieja.
- La ampliación del patrón seguro debe priorizar operaciones generales del ecommerce antes que automatizaciones ultra específicas de un tenant. Por eso se incorporaron primero categorías, ajuste de stock y parser determinístico auditable, todos visibles en catálogo y tool audit.
- 2026-03-26: la ampliación del agente para tenants específicos debe apoyarse primero en operaciones generales auditables del ecommerce. Las particularidades de `urucortinas` se montan sobre el mismo patrón seguro y no en un flujo separado.
- 2026-03-26: la auditoría de tools no queda solo en detalle; el inbox debe exponer un resumen operativo por conversación para que el operador vea de un vistazo si hubo prebúsqueda, parser o cambio de estado.
- 2026-03-26: la edición de pedidos y presupuestos desde IA no debe mutar tablas por caminos ad hoc. Debe reconstruir el documento sobre `getDocumentDetails(...)` y aplicar cambios vía `replaceDocument(...)`, para conservar recálculo, validaciones y consistencia con el flujo operativo humano.
- 2026-03-26: en `aberturas`, el paso siguiente al parseo debe ser un borrador estructurado de cotización basado en el pricing paramétrico real. Si no hay match exacto o suficiente, el sistema puede sugerir coincidencias cercanas, pero no debe presentar el ítem como listo para cotizar sin revisión.
- 2026-03-26: `customer_authenticated` es un scope persistido del sistema, no un alias de UI. Debe conservar continuidad conversacional como cliente, pero resetear limpio cuando cambia la tarea.
- 2026-03-26: en clientes autenticados, frases referenciales cortas como `ese mismo modelo` o `puede venir en negro` deben considerarse follow-up de la tarea vigente y no disparar reset por sí solas.
- 2026-03-26: el indicador `Reset de tarea` en admin debe mostrarse aunque no haya `toolCalls`; el reset es una señal operativa de memoria y no depende de auditoría de herramientas.
- 2026-03-26: `taskSummary` no es solo metadata de runtime. Debe proyectarse en admin como insumo operativo de auditoría y handoff, reutilizable por el operador dentro de `Notas operativas`.
- 2026-03-26: el comportamiento por rol del sistema IA pasa a modelarse con un `role engine` explícito y transversal a toda la plataforma, no por tenant. Los tenants agregan conocimiento y playbooks; no redefinen la ética base, la memoria, ni el control de tools. La matriz quedó documentada en `docs/ai-role-matrix.md`.
- 2026-03-26: la autorización real de herramientas no puede quedar solo en el runtime del agente. Los endpoints internos de IA deben revalidar `x-ai-role` + `x-ai-internal-token` + política de tools antes de ejecutar cualquier acción.
- 2026-03-26: el documento principal de estado/alcance/roadmap de IA pasa a ser `docs/AI_OPERATING_MODEL.md`. Los demás documentos AI quedan subordinados a ese modelo operativo o como referencia histórica.
- 2026-03-26: el roadmap práctico y priorizado de ejecución de IA pasa a quedar consolidado en `docs/AI_IMPLEMENTATION_PLAN.md`, para separar:
  - estado/alcance real
  - plan de implementación por fases
- 2026-03-26: para evitar sobredimensionamiento, la cobertura IA se considera “real” solo cuando existe:
  - tool o endpoint operativo
  - validación y confirmación
  - auditoría visible
  - prueba relevante
  - documentación activa
- 2026-03-26: la evolución del modelo de roles internos debe priorizar primero `permission envelope` por unión de grupos/capacidades. Un `rol conversacional activo` puede ser útil en algunos casos, pero no debe imponerse como requisito del MVP ni limitar a operadores con acceso amplio.
- 2026-03-26: el ABM de usuarios administrativos pasa a incorporar `grupos + capacidades` como capa funcional explícita. Si un usuario no tiene configuración explícita, conserva fallback legacy por `role`; si sí la tiene, el sistema usa ese envelope explícito. `SUPERADMIN` mantiene envelope total.
- 2026-03-26: la reconstrucción del `permission envelope` debe aceptar tanto claves funcionales del dominio (`sales`, `payments.manage`) como enums persistidos en BD/JWT (`SALES`, `PAYMENTS_MANAGE`). Si no se soportan ambos formatos, los usuarios explícitamente configurados degradan al fallback legacy y la separación por capacidad deja de ser confiable.
- 2026-03-26: en conversaciones internas, el rol administrativo base (`ADMIN`) no debe pisar una configuración explícita de grupos/capacidades al resolver el rol conversacional. El fallback `admin_internal -> admin_support` solo aplica cuando no hay contexto explícito de capabilities.
- 2026-03-26: la gestión documental y de knowledge aprobada es una capacidad transversal del producto y no una customización de `urucortinas`. Todo tenant debe contar con un flujo claro de ABM documental para contexto base de IA.
- 2026-03-26: para `aberturas`, el objetivo IA no es un ABM de matrices paramétricas ni un CRUD del glosario. El foco operativo correcto es parser determinístico de fuentes heterogéneas hacia `insertPayload` limpio y borrador estructurado de cotización, consumiendo reglas ya definidas por el sistema.
- 2026-03-26: cuando el parser backend no entienda con confianza suficiente un input operativo, el camino correcto es `backend parser -> extracción IA estructurada -> validación backend`, no ejecución directa por razonamiento libre del agente.
- 2026-03-26: los adjuntos conversacionales deben pasar por una capa de ingestión y extracción controlada antes de alimentar workflows operativos IA; mostrar/guardar archivos no equivale a tener soporte operativo real para PDF, imagen, audio o XLSX.
- 2026-03-26: esa capa de ingestión se materializa sobre un contrato canónico `ExtractedAsset` propiedad del backend. El modelo puede ayudar a extraer o normalizar, pero el contrato, la validación y la decisión de usar el resultado en un workflow operativo siguen siendo responsabilidad del sistema.
- 2026-03-26: la extracción IA estructurada desde adjuntos o texto ambiguo no reemplaza el lifecycle operativo. Solo puede refinar el draft; después siempre debe volver a pasar por validación backend y por el mismo ciclo `draft -> confirm -> execute -> verify -> respond/debug`.
- 2026-03-26: `delete` y `batch` no son flujos “especiales” fuera del patrón común. Deben usar el mismo lifecycle transversal, con diferencia solo en el formato de verificación y respuesta final:
  - `delete`: sin enlaces muertos
  - `batch`: resumen por ítem con ejecutados, fallidos y pendientes
- 2026-03-26: la inferencia de flujo desde el input del usuario es una capacidad global del sistema IA y no debe depender de la knowledge del tenant. La documentación dinámica aporta contenido y grounding, pero no define el marco de trabajo del agente.
- 2026-03-26: cuando existan elementos no textuales ambiguos, el sistema debe intentar entenderlos usando el contexto del resto de la conversación antes de escalar. Si la confianza sigue siendo insuficiente, el escape correcto es handoff humano.
- 2026-03-26: cuando varios mensajes recientes puedan ser el origen de una respuesta, el sistema debe tender a referenciar o dejar trazabilidad del mensaje objetivo. Esto es una política global de comportamiento y no una customización por tenant.
- 2026-03-26: el runtime no debe clasificar toda falla `429` como `provider_quota_exceeded`. QA y debug operativo necesitan distinguir al menos entre cuota agotada, rate limiting, auth inválida, bad request, context limit, timeout, indisponibilidad temporal y error genérico.
- 2026-03-26: el asistente interno del admin no debe reutilizar el mismo tono ni los mismos mensajes de fallback del chat cliente. En superficies internas:
  - saludos y ayuda general deben resolverse localmente sin depender del proveedor
  - un fallo del LLM no debe sugerir “tomar control de la conversación”
  - el detalle técnico queda en `debugSummary` y `auditPayload`, no en el texto final al operador
- 2026-03-26: un `HTTP 429` solo debe clasificarse como `provider_quota_exceeded` cuando exista evidencia explícita del proveedor (`insufficient_quota`, billing limit, crédito agotado). Un `429` genérico debe tratarse primero como `provider_rate_limited`.
- 2026-03-26: el fortalecimiento siguiente del runtime IA no debe hacerse por reescritura. Debe avanzar por módulos incrementales compatibles:
  - `Intent Engine`
  - `Agent State`
  - `Action Registry`
  - `Outcome Renderer`
  apoyados por una capa transversal de interpretación de elementos conversacionales (`text`, `image`, `audio`, `document`, `table`) sobre `ExtractedAsset`.
- 2026-03-26: la ejecución de cierre conversacional multimodal pasa a ordenarse con backlog por fases y slices explícitos en `docs/AI_MULTIMODAL_EXECUTION_BACKLOG.md`. Ese documento es la referencia para:
  - archivos nuevos a crear
  - archivos existentes a tocar
  - dependencias entre tareas
  - criterio de aceptación antes de considerar cerrada cada fase
- 2026-03-26: la evolución del módulo de knowledge no debe partir de una reescritura ni de una KB paralela. Debe extender el módulo actual `backend/src/knowledge` hacia un sistema de ingesta activa con human-in-the-loop, apoyado en:
  - captura normalizada desde conversaciones/canales
  - extracción estructurada a candidatos versionados
  - aprobación humana antes de promoción
  - sugerencias en tiempo real para operadores
  - reuse exclusivo de conocimiento aprobado para respuestas automáticas
- 2026-03-26: el documento de referencia para esa evolución pasa a ser `docs/AI_ACTIVE_KNOWLEDGE_INGESTION_PLAN.md`.
- 2026-03-26: la primera implementación de inferencia contextual debe ser conservadora: solo usar mensajes recientes cuando el input actual sea ambiguo o referencial, y dejar siempre trazabilidad de los mensajes usados en `audit/debug`.
- 2026-03-26: la primera fase de validación por subrol interno se cierra con E2E reales sobre operadores configurados por grupos/capacidades, no solo con unit tests del `role engine`. El contrato mínimo validado es:
  - `admin_support`: acción permitida pero pendiente de confirmación
  - `admin_sales`: acción bloqueada fuera de política
  - `admin_operations`: acción permitida con tool ejecutada visible en auditoría
- 2026-03-26: la primera implementación real de knowledge activo se monta sobre el módulo existente `backend/src/knowledge`, no como subsistema separado. La base mínima aceptada queda definida por:
  - `KnowledgeRawEvent` como observación canónica por mensaje o interacción
  - `KnowledgeIngestionRun` como trazabilidad de backfill/manual/realtime
  - `KnowledgeCandidate` enriquecido y versionado como capa revisable HITL
  - promoción a `KnowledgeDocument` solo después de aprobación humana
- 2026-03-26: la captura automática de conocimiento no puede bloquear mensajería. Si falla la observación automática desde conversaciones, el mensaje igual se persiste y la falla queda solo como error técnico recuperable.
- 2026-03-26: el retiro de lógica legacy de intención debe hacerse por capas. Los intents livianos y de capacidades pasan primero a registry central en `detectIntent()`, mientras las ramas operativas más complejas siguen temporalmente en fallback legacy hasta que el `Intent Engine` tenga cobertura equivalente.
- 2026-03-26: el `Action Registry` deja de ser solo catálogo de draft/execute. A partir de esta fase también debe transportar metadata de `resultShape` y `resultSummary` para formalizar verify/result shaping sin mover la autoridad final fuera del backend.
- 2026-03-26: las sugerencias de respuesta en el inbox admin deben reutilizar exclusivamente conocimiento aprobado. La primera integración en tiempo real se resuelve dentro de `getConversation()` y no por un endpoint separado, para que el detalle conversacional siga siendo la fuente única de verdad del inbox.
- 2026-03-26: el primer ranking operativo de sugerencias aprobadas prioriza señales determinísticas antes de semántica avanzada:
  - `dedupeHash`
  - intención detectada
  - `clusterKey`
  - similitud léxica
  la señal por embeddings podrá agregarse después, pero nunca debe abrir el uso de conocimiento no aprobado.
- 2026-03-26: el feedback de sugerencias aprobadas debe persistirse como eventos explícitos, no como flags sobre `KnowledgeCandidate`. La unidad mínima elegida es `KnowledgeSuggestionFeedback`, porque permite:
  - diferenciar `used`, `edited` y `discarded`
  - ligar feedback a conversación, mensaje objetivo y mensaje final del operador
  - reutilizar esa señal para ranking futuro sin perder trazabilidad histórica
- 2026-03-26: en el flujo de reply del inbox admin, el feedback de sugerencia no debe bloquear el envío del mensaje. Si falla la persistencia de `used/edited`, la respuesta del operador igual sale; el descarte explícito sí debe devolver error si no pudo guardarse.
- 2026-03-26: la UI HITL de knowledge pasa a mostrar métricas agregadas reales de feedback operador (`used`, `edited`, `discarded`, adopción y descarte), y cada `KnowledgeCandidate` aprobado debe exponer también su propio resumen de reuse. La calidad de knowledge no se mide solo por cantidad de candidatos sino por uso efectivo en operación.
- 2026-03-26: el siguiente retiro de legacy en intención se hace primero sobre matching directo del catálogo de acciones dentro de `detectIntent()`. El fallback legacy se mantiene solo para casos no migrados o inferencia contextual más compleja, evitando cambiar el comportamiento de producción de golpe.
- 2026-03-26: el `Action Registry` pasa a declarar explícitamente metadata de verificación y shaping de resultado por acción:
  - `verifyMode`
  - `entityLabel`
  - `resultShape`
  - `resultSummary`
  Esto permite sacar ramas implícitas del runtime sin mover la autoridad final de ejecución fuera del backend.
- 2026-03-26: el siguiente endurecimiento del `Intent Engine` debe combinar dos capas compatibles:
  - matching directo del catálogo de acciones
  - reglas explícitas para phrasing operativo natural y follow-ups
  El fallback legacy sigue existiendo, pero ya no debe ser el camino principal para intents operativos frecuentes.
- 2026-03-26: el ranking de sugerencias en inbox admin debe combinar feedback HITL con similitud semántica solo sobre conocimiento `approved`. La semántica mejora orden y recall, pero nunca habilita reutilizar conocimiento pendiente, rechazado o no validado.
- 2026-03-26: el retiro de branches manuales de `agent.js` debe priorizar copy, verificación y shaping declarativo antes que extracción libre. En esta fase, las acciones documentales toman su copy operativo desde `Action Registry`; los próximos candidatos son `customers`, `products` y `appointments`.
- 2026-03-26: el siguiente retiro declarativo del runtime se concreta sobre `customers`, `products` y `appointments`. Para estas acciones, `Action Registry` pasa a ser la fuente primaria de:
  - `draftPresentation`
  - prompts de confirmación
  - copy de éxito/error
  - metadata de verificación
  El objetivo es que `agent.js` siga orquestando estado y lifecycle, no copy por entidad.
- 2026-03-26: la cola visual de `Candidatos recientes` en AI settings debe considerarse una vista operativa resumida, no un selector confiable de candidatos puntuales en entornos con alto volumen. Mientras no exista búsqueda/filtro por candidato, la validación E2E del circuito HITL puede resolver la aprobación puntual por API admin sin perder cobertura funcional del flujo completo.
- 2026-03-26: la recuperación de la base externa local sigue siendo requisito de arquitectura. Durante la validación E2E apareció un loop de recovery en `codex-local-postgres` por falta de espacio del runtime Docker; la corrección aplicada fue liberar caché e imágenes no usadas, sin mover la base a un contenedor embebido en la app.
- 2026-03-27: `AI Runtime` no debe seguir creciendo como pantalla única de settings para operar knowledge. A partir de esta fase se lo considera un overview operativo con quick actions; el ABM real de conocimiento debe vivir en superficies dedicadas bajo `/app/settings/ai/knowledge/*`.
- 2026-03-27: la estructura administrativa mínima de knowledge debe distinguir tres dimensiones visibles sin reescribir primero el modelo persistido:
  - origen de ingreso
  - tipo de contenido
  - estado de lifecycle
  Estas dimensiones se derivan inicialmente desde `sourceType`, `scope`, `status`, `sourceFile`, `observation` y metadata existente.
- 2026-03-27: las primeras superficies ABM prioritarias del módulo de knowledge son:
  - `Knowledge Candidates`
  - `Knowledge Documents`
  seguidas por:
  - `Knowledge Raw Events`
  - `Knowledge Ingestion Runs`
  - `Knowledge Feedback`
  La cola de `recientes` en AI settings queda como resumen, no como canal principal de operación.
- 2026-03-27: el primer corte implementado del ABM de knowledge queda fijado así:
  - backend expone listas paginadas y filtrables para `documents`, `candidates`, `raw-events` e `ingestion-runs`
  - las dos primeras superficies primarias ya viven en:
    - `/app/settings/ai/knowledge/candidates`
    - `/app/settings/ai/knowledge/documents`
  - `AI Runtime` conserva solo `overview + quick actions + recientes`
  - la operación puntual y de volumen debe suceder en las listas dedicadas, no en la cola resumida del runtime
- 2026-03-27: en entornos con alto volumen, las validaciones automáticas y los flujos operativos sobre knowledge no deben depender de listas amplias sin filtro. Deben usar `search/order/pageSize` sobre las queries dedicadas para seleccionar el candidato o documento puntual que se quiere revisar, aprobar o medir.
- 2026-03-27: la UX futura del módulo de knowledge se divide en dos superficies complementarias y no excluyentes:
  - una vista general tipo `help center` para explicar qué sabe hoy el agente y el estado del conocimiento
  - una vista operativa tipo `training board` para gobernar el entrenamiento activo con HITL
  Estas vistas deben construirse sobre el ABM ya implementado de `Knowledge Candidates` y `Knowledge Documents`, no en paralelo ni como reemplazo.
- 2026-03-27: la referencia visual para esa evolución puede tomar layout y patrones del template original de admin ubicado en `/Users/rodrigo/Personal/Proyectos/react projects/Elstar - React Tailwind Admin Template`, pero solo como input de diseño. No debe agregarse dependencia runtime al proyecto externo.
- 2026-03-27: esa evolución UX ya queda aterrizada en rutas concretas dentro del admin actual:
  - `/app/settings/ai/knowledge/overview`
  - `/app/settings/ai/knowledge/manage-articles`
  - `/app/settings/ai/knowledge/raw-events`
  - `/app/settings/ai/knowledge/ingestion-runs`
  `AI Runtime` conserva el rol de overview técnico/quick actions y enlaza a estas superficies; no vuelve a absorber operación fina.
- 2026-03-27: `Knowledge Documents` deja de ser solo listado/alta y pasa a ser ABM real de contenido aprobado. La operación mínima ya incluye edición de `title`, `summary`, `content`, `tags`, `scope` y `status`, manteniendo backend como autoridad para reindex y metadatos de edición.
- 2026-03-27: `Knowledge Feedback` pasa a ser superficie dedicada del módulo de knowledge y no un dato enterrado en analytics o en el inbox. La revisión de reuse debe poder distinguir:
  - `used`
  - `edited`
  - `discarded`
  con contexto de candidato, conversación, mensaje objetivo y respuesta final del operador.
- 2026-03-27: `Knowledge Manage Articles` debe priorizar acciones directas explícitas por card antes que `drag-and-drop`. El tablero gobierna un flujo HITL sensible; por eso `drag-and-drop` solo se justifica si después de observar operación real demuestra una mejora clara sin introducir ambigüedad.
- 2026-03-27: la unidad revisable/aprobable de knowledge derivada de conversaciones no debe ser una pregunta aislada del cliente. La unidad mínima gobernable es el intercambio:
  - mensaje de usuario
  - respuesta humana o IA asociada
  - contexto mínimo del canal/scope/intención
  Los inbound sin respuesta asociada permanecen como `KnowledgeRawEvent` y no deben materializar `KnowledgeCandidate` por defecto.
- 2026-03-27: aprobar una conversación completa no es la estrategia base del sistema. El modelo actual debe trabajar en `exchange-level approval` para mantener precisión, evitar mezclar múltiples intents y reducir contaminación/Pii incidental. `conversation bundle` queda como evolución futura para playbooks multi-turno explícitos.
- 2026-03-27: `Knowledge Manage Articles` se alinea finalmente al patrón visual y de interacción de `project/ScrumBoard` del template base:
  - board horizontal
  - cards clickeables
  - cambio de estado por `drag-and-drop`
  - columnas fijas de pipeline
  El board resuelve el avance positivo del flujo; los descartes y revisiones finas siguen en las vistas detalladas.
- 2026-03-27: en el inbox admin, el composer y sus acciones no pueden volver a competir con el scroll del detalle. La regla operativa queda fijada así:
  - transcript con scroll principal
  - sugerencias/auxiliares del footer con scroll propio si hace falta
  - composer siempre visible y utilizable dentro del viewport
- 2026-03-27: `Asistente interno` debe estar siempre visible como sugerencia fija en el flujo de nuevo mensaje del inbox, aun cuando el buscador no devuelva más contactos. El contacto interno del agente no se trata como un resultado incidental de búsqueda sino como una affordance operativa permanente.
- 2026-03-27: `/app/settings/ai` deja de ser la pantalla gigante de runtime y pasa a ser el hub del módulo `IA`. El runtime operativo se mueve a `/app/settings/ai/runtime`, y las superficies de knowledge quedan como subopciones explícitas de menú bajo un módulo `AI` independiente del collapse general de `Settings`.
- 2026-03-27: `conversation bundle` y `negative examples` quedan definidos como superficies futuras del módulo de knowledge, pero no entran todavía al circuito productivo principal:
  - `conversation bundle` servirá para gobernar secuencias multi-turno donde el valor esté en el hilo completo
  - `negative examples` servirá para registrar respuestas rechazadas, obsoletas o inseguras que deben penalizar ranking/reuse y reforzar guardrails
- 2026-03-27: `AI Runtime` ya no debe contener formularios, uploads ni acciones operativas de knowledge. Esos flujos quedan repartidos así:
  - `Knowledge Documents`: carga manual, upload y reindex
  - `Knowledge Ingestion Runs`: observación/ingesta manual
  - `Knowledge Feedback`: métricas de reuse
  El runtime queda restringido a configuración técnica, prompts, límites y catálogo de acciones.
- 2026-03-27: el indicador visible en `/app/settings/ai` no debe interpretarse como “madurez del modelo”. Mide cobertura operativa del conocimiento disponible y toma como referencia:
  - documentos activos
  - intercambios pendientes
  - observaciones detectadas
  No evalúa calidad del LLM ni precisión del modelo.
- 2026-03-27: el comportamiento base del asistente debe existir aunque no haya knowledge aprobado cargado y debe venir habilitado por defecto para cualquier tenant o slug:
  - saludar y responder con naturalidad
  - pedir la aclaración mínima necesaria
  - explicar límites sin inventar datos
  - mantener la conversación abierta salvo bloqueo, riesgo o necesidad operativa real
- 2026-03-27: `conversation bundles` y `negative examples` dejan de ser solo backlog abstracto y pasan a existir como superficies explícitas del módulo de knowledge:
  - `conversation bundles` para explorar hilos multi-turno candidatos a futura aprobación por secuencia
  - `negative examples` para concentrar descartes/rechazos como señales de ranking y guardrails
- 2026-03-27: el sistema necesita una capa explícita de `Knowledge Snapshot` o `Agent Knowledge Digest` para responder qué conocimiento operativo está vigente hoy. Ese snapshot no describe “lo que sabe el modelo en sus pesos”; describe el conocimiento aprobado y trazable que el runtime puede usar.
- 2026-03-27: el snapshot debe distinguir tres capas y no mezclarlas:
  - `knowledge activo`:
    - documentos activos aprobados
    - candidates aprobados
    - bundles aprobados
    - negative examples aprobados como guardrails
  - `señales pendientes`:
    - raw events
    - candidates pendientes
    - bundles pendientes
    - negative examples pendientes
  - `histórico/auditoría`
- 2026-03-27: los `negative examples` sí pueden y deben influir en el snapshot cuando estén aprobados. En ese caso entran como `guardrail_negative` o regla negativa vigente. Los `negative examples` no aprobados no forman parte del digest activo; solo deben verse como pendientes, riesgo o backlog de revisión.
- 2026-03-27: el primer corte implementado de `Knowledge Snapshot` se apoya solo en fuentes persistidas reales del backend:
  - `KnowledgeDocument` activos/aprobados
  - `KnowledgeCandidate` aprobados
  - `KnowledgeRawEvent` como señales pendientes/gaps
  `conversation bundles` y `negative examples` ya están contemplados en el diseño, pero no entran todavía al snapshot persistido porque hoy no existen como modelos backend reales.
- 2026-03-27: `conversation bundles` y `negative examples` pasan de diseño futuro a fuentes activas del snapshot:
  - `KnowledgeConversationBundle` aprobado entra al digest vigente como `topic_summary` con rol `secondary_support`
  - `KnowledgeNegativeExample` aprobado entra al digest vigente como `guardrail_negative` con rol `guardrail`
  - los estados `pending` y `rejected` siguen fuera del digest activo y deben mostrarse solo como revisión/backlog/riesgo
- 2026-03-27: conviene evaluar una capa de `knowledge elementization` para contenido manual o documental cargado por operadores:
  - texto ingresado por formulario
  - documentos subidos
  - texto plano curado
  pueden transformarse en unidades reutilizables positivas o negativas, siempre con trazabilidad explícita de origen
  - ejemplo positivo: regla operativa, patrón de respuesta, política aprobada
  - ejemplo negativo: guardrail tipo “no revelar información sensible”, “no usar lenguaje inapropiado”
  esto no implica promover automáticamente cualquier texto a knowledge activo; implica poder derivar `elements` revisables desde una misma fuente y mantener vínculo con:
  - documento/form origen
  - fragmento exacto utilizado
  - versión de la fuente
  - revisión humana posterior
  esta evolución queda aprobada como línea de diseño, pero no como obligación inmediata de implementación
- 2026-03-27: el snapshot no puede quedar vacío aun cuando falte conocimiento aprobado suficiente. Debe incluir siempre una capa explícita de reglas base predeterminadas del runtime:
  - cliente: conversación natural, aclaración mínima, visibilidad segura
  - admin interno: apoyo operativo, confirmación antes de ejecutar, errores/faltantes claros
  Estas reglas no reemplazan el conocimiento aprobado; funcionan como base estable y también deben seguir visibles dentro del resumen general cuando sí hay conocimiento específico.
- 2026-03-27: el primer `diff` de snapshot se resuelve de forma determinística en backend, comparando entries por `key` y señalando `added`, `removed` y `changed` contra la versión anterior. No hace falta persistir un modelo adicional de diff para el MVP; el cálculo puede hacerse on-demand sobre snapshots ya versionados.
- 2026-03-27: para acciones de `activity` o agenda, el sistema no debe limitarse a crear el evento. La evolución correcta requiere primero una capa explícita de disponibilidad y restricciones:
  - verificar disponibilidad real en la tabla de activities
  - sugerir horarios alternativos
  - limitar agendas fuera del horario comercial
  - proyectar esas restricciones directamente en UI:
    - días no disponibles
    - franjas bloqueadas
    - horarios sugeridos
  este punto queda fuera del bloque actual de knowledge, pero entra como backlog futuro de scheduling/UX operativa
- 2026-03-27: los saludos livianos del runtime dejan de ser texto fijo en código y pasan a configuración administrable:
  - se exponen en `AI Runtime`
  - el runtime sigue teniendo defaults seguros para cualquier tenant
  - la configuración solo ajusta wording/tone del saludo base; no reemplaza la lógica de intención ni los outcomes compartidos
- 2026-03-27: las URLs pasan a ser una fuente first-class del módulo de knowledge mediante `KnowledgeDocument.sourceType = WEB_URL`:
  - no se crea un subsistema paralelo de sources para el MVP
  - la propia entidad documental guarda:
    - `url`
    - `refreshPolicy`
    - `lastFetchedAt`
    - `lastCheckedAt`
    - `nextRefreshAt`
    - `etag`
    - `lastModified`
  - esto permite reutilizar de inmediato:
    - embeddings
    - retrieval
    - snapshot
    - ABM documental
  - `refresh-due` queda disponible como operación batch explícita; un scheduler posterior puede consumirla sin rediseñar el modelo
- 2026-03-27: para el cierre conversacional, el sistema prioriza limpieza y coherencia sobre soporte legacy:
  - si una intención ya fue resuelta por la capa nueva del `Intent Engine`, no debe recalcularse por una rama legacy posterior
  - las respuestas determinísticas customer compartidas viven en el renderer común y no en helpers duplicados dentro de `agent.js`
  - los follow-ups breves pueden apoyarse en contexto reciente de cliente y agente, no solo en turns del usuario
- 2026-03-27: el transcript canónico de webchat debe exponer adjuntos con `content` cuando esa señal ya existe en la persistencia:
  - esto permite mantener previews de imagen/audio después del sync
  - no implica generar contenido binario nuevo en backend; solo preservar y proyectar el ya ingresado por el canal/UI
  - si el adjunto no trae `content`, la UI cae al render textual/tipado sin inventar preview
- 2026-03-27: la paridad entre admin y storefront no debe limitarse a `controlMode`; también debe hacer visible el estado operacional del hilo:
  - storefront muestra un banner explícito cuando la conversación ya está en seguimiento humano o híbrido
  - admin y storefront usan el mismo vocabulario base:
    - `Asistente IA`
    - `IA + equipo`
    - `Asesor humano`
  - el handoff visible es una señal de estado, no un error ni una interrupción del canal
- 2026-03-27: los listados admin no deben depender exclusivamente del `body` del último mensaje para su preview:
  - `latestMessage` deriva `preview` y `previewKind` a partir de texto, adjuntos y `messageElements`
  - si el texto del último mensaje es solo un resumen técnico de adjuntos (`[Adjunto: ...]`), el sistema debe preferir una vista más legible del primer adjunto relevante
  - esto mejora coherencia entre transcript detallado y vista resumida sin mover lógica de presentación al frontend
- 2026-03-27: el contrato canónico de email debe mantener la misma semántica de autor y preview que el resto de la mensajería:
  - summaries, threads y detail del inbox email exponen `authorLabel`
  - el listado admin de conversaciones email debe mostrar el asunto cuando existe, no solo el body más reciente
  - las regresiones E2E deben navegar por el directorio lateral de canales, no asumir filtros inline que ya no forman parte del layout actual
- 2026-03-27: una cuenta email no debe considerarse operable por el simple hecho de existir en `InboxAccount`.
  El criterio mínimo aprobado es:
  - cuenta activa
  - configuración IMAP/SMTP/remitente completa
  - evidencia mínima de conectividad persistida:
    - `smtpTlsVerifiedAt`
    - `imapTlsVerifiedAt`
    - `smtpVerifyVerifiedAt`
  Este criterio gobierna tanto el listado admin del inbox como la resolución inbound de conversaciones email.
- 2026-03-27: el estado limpio para regresión no se resuelve con borrado manual ad hoc.
  Se aprueba un proceso repetible de saneamiento que:
  - preserva baseline y configuración real
  - preserva la cuenta email operable configurada
  - elimina conversaciones sintéticas de email y residuos conversation-derived asociados
  La referencia operativa queda en [REGRESSION_CLEAN_STATE.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/REGRESSION_CLEAN_STATE.md).
- 2026-03-27: los casos no contemplados del runtime conversacional deben capturarse con un esquema estructurado y no como observaciones informales.
  El registro mínimo debe incluir:
  - input crudo
  - salida visible esperada vs real
  - clasificación/intención/fallback usados
  - si hubo llamada al proveedor
  - bucket diagnóstico
  - tipo de fix propuesto
  La referencia operativa queda en [AI_ERROR_FLOW_CAPTURE_SCHEMA.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_ERROR_FLOW_CAPTURE_SCHEMA.md).

## Analytics

### Growth & Insights queda separado de Analytics operativo

- `Growth & Insights` permanece como pantalla de configuración de tracking, tags, medición y conectores de marketing.
- `Analytics` es la superficie de consumo y operación del negocio: overview, funnel, conexiones, sync runs e insights.
- Razón: separar la configuración del instrumento de la lectura del negocio evita mezclar responsabilidades, reduce errores de UX y deja el sistema listo para evolucionar a microservicio.

### Los conectores viven en `AnalyticsModule`

- OAuth, estado de conexión, credenciales cifradas, runs de sincronización, reporting y insights quedan dentro de `backend/src/analytics`.
- `GrowthModule` no absorbe esa lógica.
- Razón: los conectores forman parte de la cadena operativa de analítica, no de la edición de tracking, y necesitan trazabilidad, jobs y reporting normalizado.

### La IA consume métricas normalizadas y evidencia

- La IA no debe leer raw events ni JSON crudo como fuente primaria.
- La IA trabaja sobre métricas normalizadas, contexto dimensional y evidencia persistida en insights.
- Razón: los eventos crudos sirven para ingesta y normalización; las decisiones deben salir de datos consistentes, comparables por rango y auditables.

### El frontend no recibe tokens

- El admin sólo consume `status`, `target`, `lastSyncAt`, `nextSyncAt` e historial de runs/insights.
- Los `refresh_token` y `access_token` quedan cifrados en backend.
- Razón: reducir superficie de fuga de credenciales y evitar que la UI mezcle visualización con secretos operativos.

### La prioridad de fuentes depende del objetivo de negocio, pero el primer slice es GA4

- Si el foco es comportamiento y funnel onsite, la primera fuente es `GA4`.
- Si el foco es CAC o ROAS, la primera fuente es `Google Ads`.
- Si el foco es SEO y demanda orgánica, la primera fuente es `Search Console`.
- Para este repo, el primer slice prioriza `GA4` porque el dashboard actual ya valora overview/funnel y la materia prima existente vive en eventos normalizados.
- Razón: maximizar valor temprano sin perder la capacidad de reordenar la roadmap cuando cambie la pregunta de negocio.

### Los insights visibles deben ser trazables

- Cada insight visible debe conservar `metric`, `dimension`, `confidence`, `impact` y `evidence`.
- Razón: una recomendación sin evidencia no puede ser auditada ni defendida operativamente.

### Los exports locales de Google son referencia, no fuente operacional

- El material exportado localmente desde Google Ads / Search Console / informes mixtos se puede usar para entender negocio y calibrar decisiones.
- Ese material no debe tratarse como input productivo mientras no exista un pipeline explícito de ingesta y normalización.
- Razón: evitar que una carpeta local o un ZIP manual se confunda con una fuente viva del sistema.
