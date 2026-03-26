# Tasks

## Priority Backlog

### P0 — Security / exposure gate

- Audit and enforce minimum endpoint protections across the whole system:
  - authentication/authorization
  - rate limiting
  - origin restrictions
  - external exposure review
- Use `docs/endpoint-protection-audit-matrix.md` as the canonical tracking matrix for endpoint protection status by module and endpoint group

### P1 — Close admin messaging before expanding surfaces

- Add real historical mailbox backfill per mailbox for email inbox accounts
- Add real cursor-based pagination for email inbox history instead of latest-window sync only
- Keep `ownership / routing / SLA` improvements documented as a second-stage operational hardening pass:
  - weighted routing
  - SLA escalation
  - richer ownership/reassignment rules
  - queue supervision metrics
- Implement `admin_internal` scoped conversations for product/customer/order/payment workflows with guided review UX

### P1.2 — Cross-channel merge hardening (deferred)

- Ensure cross-channel threading behavior promotes revived conversations back to the top when older threads receive new inbound/outbound activity
- Harden unified thread merging rules for email and messaging channels around provider thread ids, message ids and fallback heuristics
- Keep this deferred until admin routing / ownership / SLA is in a stronger operational state

### P1.5 — Close admin messaging visually

- Promote the template-driven inbox as the primary admin conversations experience
- Keep the current conversations surface available in parallel as `Conversations V2` during migration
- Reimplement the new layout in React inside the current admin stack using the HTML version as the visual source of truth
- Keep the responsive behavior already stabilized in mobile and desktop
- Finish this pass before starting storefront messaging rollout

### P2 — Improve AI quality on top of stable operations

- Add richer candidate review workflow for conversation-derived knowledge, including batch review and revision notes
- Add admin knowledge search/retrieval observability and snippet feedback loop
- Add provider-backed embedding model support and async reindex scheduling beyond the local vector baseline
- Add retrieval feedback signals and ranking analytics for approved knowledge documents

### P3 — External onboarding and future storefront rollout

- Add admin runtime usage charts and provider health diagnostics
- Add secure rotation flow for provider credentials and secret provenance
- Add outbound delivery/state webhook coverage for real Meta providers once credentials are available
- Add tenant onboarding flow for real outbound email status callbacks and provider credential validation
- Implement storefront public chat on top of shared messaging primitives without persistence and without privileged access
- Implement logged-in customer chat on top of shared messaging primitives with real persisted conversation history and customer-safe context

## In Progress

- Expand `data-testid` coverage for inbox/conversation/channel filters
- Keep growing messaging regression coverage over the template-driven admin inbox while preserving stable selectors across layout migration
- Keep validating real mailbox folders (`INBOX`, `Sent`, `Junk`, etc.) against configured accounts so the admin mail surface does not silently fall back into legacy datasets
- Connect retrieval snippets to provider-backed prompts with approval-aware ranking and tenant scoping
- Expand `admin_internal` action coverage from create-only flows toward practical CRUD:
  - customer search/update
  - activity search/update/delete
  - product update/archive
  - next stage: order/quote/payment state changes
  - keep search-first behavior active before quote/order/payment updates or confirmations
- Keep validating the managed AI knowledge-document flow:
  - upload from AI settings
  - visible managed card
  - open/download source file
  - delete
  - re-upload
- Keep curating tenant-specific operational documents through the managed upload path, starting with `UruCortinas`
- Keep the `aberturas` master prompt contract aligned with live code and playbooks:
  - `docs/knowledge/aberturas-admin-internal-master-prompt.md`
  - `docs/knowledge/aberturas-parser-backend-recommendation.md`
  - `docs/knowledge/urucortinas-aberturas-operational-etl-playbook.md`
  - `aberturas_enterprise` survey inputs
  - if code/path behavior changes, update the master prompt before closing the slice
- `aberturas` parser backend migration:
  - [x] Phase 1: extract the current deterministic parsing layer from `ai.service.ts` into `backend/src/aberturas/parser/*`
  - [ ] Relevar y unificar el código ya existente útil del dominio antes de seguir expandiendo el parser:
    - `backend/src/aberturas/*`
    - `backend/src/pricing/parametric-pricing.service.ts`
    - `docs/glosario_normalizado.json`
    - `docs/esquema_parametrico_definitivo.json`
    - flujos de cotización/admin ya vivos
  - [ ] Refactorizar o reutilizar esas piezas donde aporten valor real, evitando duplicar lógica entre parser, glosario, pricing y flujos de presupuesto
  - [ ] Phase 2: add controlled context inheritance, canonical dedupe and standardized warnings from the surveyed enterprise/Python flow
  - [ ] Phase 3: expose reusable batch parsing for WhatsApp export / PDF ingestion
  - [ ] Phase 4: simplify the AI prompt so the agent keeps only intent, confirmation and role-adapted wording
- Keep validating role/scope boundaries in AI behavior:
  - `customer_public` must not offer internal CRUD/ABM flows
  - `admin_internal` operational actions remain restricted to authenticated internal roles
  - fallback/error wording must stay human-friendly and non-technical
- Keep enriching tenant playbooks through the managed upload path, including:
  - commercial rules
  - quotation criteria
  - objection handling
  - operational policies
- Converge email inbox behavior toward the canonical messaging contract with backend-first threading/order/pagination rules
- Complete the basic admin email flow:
  - sync now from UI
  - complete history from UI
  - backend-first grouping/thread reading
  - reply flow over canonical thread list
  - preserve `account + mailbox + mail` in URL when opening detail
  - clarify synced-message count vs visible thread count
  - resolve legacy `Mail` thread access into `/app/crm/conversations/:conversationId` whenever the thread is already linked to the canonical hub
- Reimplement the admin chat surface with the new messaging layout as the dominant visual reference:
  - transcript styling
  - list/detail shell
  - mobile-first usability
  - message type rendering for text, attachments, image and audio
  - exact parity pass on list/header/composer/detail drawer
  - contextual messaging rail replacing the old local actions strip inside the `Mensajes` section
  - keep the new route operational while parity closes:
    - global new chat
    - reply from selected conversation
    - search inside the active chat
    - channels/inboxes navigation
    - transition between global admin navigation and messaging-specific actions
  - keep message actions staged and capability-aware as documented in `docs/messaging-actions-roadmap.md`
  - Invert the coexistence strategy:
  - new template-driven inbox becomes the principal route
  - current inbox remains separated as `Conversations V2` until migration is closed
- Keep all CSS/media assets required by the new chat layout copied into the current project so the implementation does not depend on the external template path at runtime
- Keep ownership / routing / SLA documented as recommended follow-up after exploratory testing
- keep conversation pinning as a backend-shared signal, not local-only UI state

## Done

- Analyzed external `dreamschat-v2.8.4` template viability and documented the recommendation to use it as a pattern reference rather than a direct dependency
- Converted the messaging template analysis into a concrete shared messaging primitives spec and initial implementation in `frontend/src/components/messaging`
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
- Added initial AI knowledge-base planning across docs, backend datasets, curated admin input and conversation-derived candidates
- Added transport-event traceability to conversation detail with outbound delivery badges
- Added queue diagnostics for count, unassigned load, breached SLA and oldest inbound activity
- Added explicit confirmation behavior for `admin_internal` action requests before tool execution
- Added outbound email status webhook contract and E2E coverage for status sync
- Added Meta outbound delivery sync E2E coverage over the unified inbox
- Added durable knowledge entities for curated documents and conversation-derived candidates
- Added first ingestion jobs from trusted docs and backend datasets into the AI knowledge store
- Added admin UI to ingest docs/datasets, create curated entries and review pending knowledge candidates
- Added queue assignment persistence with operator capacity, assignment mode and SLA target fields
- Added auto-assignment for least-loaded queues on inbound conversation creation
- Added supervisor override for queue/operator reassignment directly from the conversation detail
- Added action-specific confirmation guidance for `admin_internal` AI actions from the backend action catalog
- Added lexical retrieval over approved `KnowledgeDocument` entries only, excluding raw messages and pending candidates
- Added AI runtime consumption of approved retrieval context before response generation
- Added persisted `KnowledgeDocumentEmbedding` projection with manual reindexing from admin settings
- Added hybrid retrieval ranking combining lexical score and local vector similarity over approved knowledge only
- Stabilized AI conversations QA block by serializing shared-state specs and tightening internal/meta regressions
- Defined the canonical messaging contract for threading, ordering, pagination and cache across channels
- Added cursor-based historical loading helpers for the email inbox provider
- Added admin inbox UI affordances for `Load older messages` and sync completeness visibility
- Added backend-driven canonical thread keys and activity timestamps to inbox message summaries
- Added backend support for full-history mailbox synchronization loops with bounded paging
- Added a backend canonical email thread-list endpoint
- Switched the `Emails` admin surface to consume backend thread summaries instead of primarily re-grouping raw messages in frontend state
- Added operator-facing mailbox history sync controls with visible `partial` vs `complete` state in the admin email inbox
- Added resumable mailbox history sync metadata and visible history-sync timestamps for admin email inboxes
- Hardened email thread fallback identity to prefer `subject + participants` before subject-only grouping
- Improved conversation list operational prioritization with SLA-breached and unassigned-first ordering cues
- Exposed backend-driven operational conversation signals for `needsAssignment` and `isSlaBreached`
- Added explicit `Sync now` action to the admin email inbox
- Added visual thread count cues to the admin email inbox list
- Fixed admin `Mail` inbox routing to preserve mailbox context when opening a thread detail
- Fixed admin `Mail` inbox category detection so the real inbox path no longer falls back into legacy grouping/detail logic
- Added frontend regression coverage for canonical inbox-category detection and a real-account inbox E2E smoke
- Added a first messaging E2E focused on transcript rendering for text, attachment, image and audio in admin conversations
- Added a broader admin messaging regression covering filters drawer presence, shared pin, reply flow, read/unread menu contract and navigation from `Mensajes` to `Mail`
- Added a strict admin messaging search regression so result matching is now covered as an E2E contract over seeded conversations
- Realigned `admin-conversations` and `admin-conversation-actions` regressions with the current template-driven messaging UI and restored the missing stable `data-testid` hooks they need
- Added owner visibility and bulk owner actions to the template-driven admin inbox so operators can identify and switch multiple chats between AI and human control from one surface
- Added production-like managed knowledge-document flow in AI settings:
  - upload from admin UI
  - persisted source file metadata in `KnowledgeDocument`
  - open/download endpoint for the original document
  - delete from UI
  - re-upload support
- Added persistent host-mounted storage for uploaded knowledge files so managed documents survive backend container rebuilds
- Added tenant-specific public-site ingestion sources for `urucortinas`
- Loaded the initial `UruCortinas` report as a managed knowledge document through the same upload flow expected in production
- Added `docs/knowledge/urucortinas-admin-internal-curated.md` as a curated internal source document and uploaded it through the managed knowledge flow for `admin_internal`
- Improved `admin_internal` grounding behavior by:
  - strengthening the prompt so retrieved approved context must be used first
  - improving snippet extraction so long business queries surface relevant sections instead of only document intros
- Added internal AI action support for:
  - searching customers
  - updating customers
  - searching appointments/activities
  - updating appointments/activities
  - deleting appointments/activities
  - updating products
  - archiving products
- Added internal AI search support for:
  - orders
  - quotes
  - payments
- Added deterministic runtime pre-search for selected `admin_internal` operations so the agent can use backend results before asking for IDs or final confirmations
- Validated the new internal AI action endpoints with real backend requests for customer and activity lifecycle flows
- Added a master prompt-style document for `aberturas` that consolidates:
  - external ETL/prompt rules
  - external parser survey
  - current backend/frontend contract
  - approved internal `urucortinas` playbook
- Added a detailed parser-process survey document for `aberturas` inputs, normalization, segmentation, validation and insert-ready output criteria
- Added a backend-parser recommendation document for `aberturas` to formalize the split between deterministic domain logic and agent responsibilities
- Added regression coverage for managed AI knowledge documents including upload, open, delete and re-upload
## AI runtime / knowledge

- [x] Persistir `needsHuman` en conversación
- [x] Exponer grounding aprobado en inbox admin
- [x] Parametrizar prompts por scope (`admin_internal`, `customer_public`)
- [x] Activar runtime OpenAI real en entorno local
- [x] Degradar a fallback humano si el proveedor falla o queda sin cuota
- [ ] Cambiar a una API key con cuota/billing habilitado para validar respuestas OpenAI completas en local
- [ ] Reflejar en UI cuándo una respuesta IA fue grounded vs fallback por error de proveedor
- Hecho:
  - cambios de estado seguros para pedido, presupuesto y pago en `admin_internal`
  - citacion explicita de coincidencias de prebúsqueda en respuestas internas
  - catalogo visible en UI de AI Settings con CRUD habilitado por `admin_internal`
  - prompt persistido de `admin_internal` alineado a operativa real y flujo de aberturas
  - edición estructural segura de pedidos y presupuestos usando el servicio real de reemplazo del backend
  - borrador estructurado de cotización de `aberturas` usando pricing paramétrico real

- Pendiente siguiente:
  - exponer en conversaciones cuando una respuesta uso matches de prebúsqueda y que accion quedo sugerida
  - ampliar regresiones E2E de `admin_internal` para cambios de estado sobre pedido/presupuesto/pago
  - ampliar regresiones de `admin_internal` para edición estructural de pedidos/presupuestos y `prepare_aberturas_quote`
- IA `admin_internal`:
  - siguiente cierre recomendado: exponer en inbox/tool audit cuándo una respuesta se apoyó en coincidencias de prebúsqueda y cuándo ejecutó cambios de estado seguros
  - pendiente posterior: conectar `prepare_aberturas_quote` con un flujo explícito de creación de presupuesto/alta confirmado por operador
- operaciones seguras:
  - ampliar desde el survey de [docs/ai-safe-operations-survey.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-safe-operations-survey.md) empezando por operaciones generales reutilizables entre tenants
  - siguientes candidatas: edición estructural más fina por línea, cambios de vigencia/envío más ricos, publicación/despublicación explícita y ajustes de stock con motivo auditado
- ampliar cobertura E2E/QA del bloque AI operativo:
  - auditoría resumida en inbox
  - parser de `aberturas` visible en tool audit
  - nuevas operaciones generales (`publish/update_comment/update_payment/update_category`)
- siguiente ampliación general recomendada:
  - exponer en UI y auditoría cuándo un update estructural reemplazó items completos vs append/remove
  - conectar borradores de `aberturas` con confirmación y generación efectiva de presupuesto
