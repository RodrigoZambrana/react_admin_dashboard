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
- 2026-03-26: la primera implementación de inferencia contextual debe ser conservadora: solo usar mensajes recientes cuando el input actual sea ambiguo o referencial, y dejar siempre trazabilidad de los mensajes usados en `audit/debug`.
- 2026-03-26: la primera fase de validación por subrol interno se cierra con E2E reales sobre operadores configurados por grupos/capacidades, no solo con unit tests del `role engine`. El contrato mínimo validado es:
  - `admin_support`: acción permitida pero pendiente de confirmación
  - `admin_sales`: acción bloqueada fuera de política
  - `admin_operations`: acción permitida con tool ejecutada visible en auditoría
