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
- Connect retrieval snippets to provider-backed prompts with approval-aware ranking and tenant scoping
- Converge email inbox behavior toward the canonical messaging contract with backend-first threading/order/pagination rules
- Complete the basic admin email flow:
  - sync now from UI
  - complete history from UI
  - backend-first grouping/thread reading
  - reply flow over canonical thread list
- Reimplement the admin chat surface with the new messaging layout as the dominant visual reference:
  - transcript styling
  - list/detail shell
  - mobile-first usability
  - message type rendering for text, attachments, image and audio
  - Invert the coexistence strategy:
  - new template-driven inbox becomes the principal route
  - current inbox remains separated as `Conversations V2` until migration is closed
- Keep all CSS/media assets required by the new chat layout copied into the current project so the implementation does not depend on the external template path at runtime
- Keep ownership / routing / SLA documented as recommended follow-up after exploratory testing

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
- Added a first messaging E2E focused on transcript rendering for text, attachment, image and audio in admin conversations
