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
