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
- initial knowledge-base strategy documented with source hierarchy and ingestion phases
- queue diagnostics and transport-event traceability surfaced directly in the admin inbox
- outbound delivery sync tested for email and Meta in the unified conversation flow
- `admin_internal` destructive intents now require explicit confirmation before tool execution
- QA block `storefront-e2e-ai-conversations` green again after aligning the suite with the drawer-based inbox layout
- durable AI knowledge persistence for curated documents and conversation-derived candidates
- first ingestion paths from trusted docs and backend datasets into the AI knowledge store
- admin UI to ingest knowledge, curate entries and approve/reject candidates
- persisted queue assignment metadata with capacity and least-loaded auto-assignment
- supervisor override to reroute a conversation to another queue/operator from the inbox detail
- SLA detail visible and actionable inside the operator drawer without polluting the transcript surface
- backend action catalog now drives richer confirmation guidance for destructive `admin_internal` actions
- retrieval baseline active over approved `KnowledgeDocument` records only and already injected into AI runtime prompts
- persisted embedding projection is now active for approved knowledge, with admin-triggered reindex and hybrid lexical/vector ranking
- external messaging template viability has now been analyzed and documented, with a recommendation to abstract shared messaging primitives instead of importing the template code directly
- current email inbox polling/sync is operational, but historical sync is still windowed to recent messages and not yet a full mailbox backfill
- canonical threading/ordering/pagination contract is now explicitly documented for cross-channel convergence
- minimum endpoint protections are now explicitly tracked as a cross-system audit requirement before expanding more channels
- endpoint protection tracking now has a dedicated operational matrix by module and endpoint group
- pending work is now reorganized into a prioritized execution order in `docs/next-steps-prioritized.md`
- immediate execution order is now explicitly adjusted to close admin messaging first, then give it a dedicated visual closure pass inside admin before storefront rollout
- the messaging migration strategy is now inverted:
  - the new template-driven inbox becomes the principal admin conversations route
  - the existing conversations surface remains available in parallel as `Conversations V2` until the migration is accepted and the previous view can be removed

## This Iteration Focus

- documented the remaining email inbox gaps: historical backfill, cursor pagination and UI sync completeness status
- documented that endpoint protection verification is not email-specific and must be audited across all exposed backend/admin/storefront/service endpoints
- created `docs/endpoint-protection-audit-matrix.md` with `covered / partial / pending` status per module and endpoint group
- reorganized the pending work into `P0 / P1 / P2 / P3` to clarify what blocks channel growth and what can wait
- added an explicit `P1.5` style-closure step so the admin messaging product is closed both functionally and visually before extending it elsewhere
- implemented first email convergence slice with cursor-based historical loading and visible sync completeness state in the admin inbox
- implemented backend-driven canonical email thread keys and activity timestamps so inbox grouping no longer depends mainly on frontend subject heuristics
- implemented backend support for full-history mailbox sync loops using `fullHistory` plus `maxPages`
- implemented a dedicated backend canonical email thread-list endpoint
- switched the admin `Emails` surface to trust backend thread summaries first, instead of primarily re-grouping raw messages in frontend state
- added operator-triggered full-history sync controls in the admin email inbox, with visible `partial` vs `complete` state
- added resumable mailbox history sync metadata, including history completion timestamps and fetched-page traces
- hardened email fallback threading to prefer `subject + participants` before subject-only grouping
- improved admin conversation ordering so SLA-breached and unassigned work surfaces higher in the inbox
- exposed backend-driven operational conversation signals so the admin list does not need to infer SLA breach and assignment urgency entirely in frontend
- cross-channel merge hardening is now intentionally deferred behind routing / ownership / SLA, to keep the next slice focused on operator reliability
- de-scoped deeper `ownership / routing / SLA` implementation from the current slice to avoid overbuilding before exploratory testing
- shifted the current focus to a basic operational email inbox result: sync, grouping, thread reading and reply
- added explicit `Sync now` mailbox action in the admin email inbox
- improved email inbox thread readability with visible per-thread message count in the list
- restyled the admin messaging primitives toward the new template-driven visual language instead of continuing with the older interim look
- added transcript rendering for text, attachments, image and audio in the admin conversation detail
- validated a first visual/runtime E2E specifically for admin message types
- documented storefront chat rollout pending on top of shared messaging primitives with public vs logged-in split
- completed first runtime slice of AI knowledge ingestion and review
- completed queue ownership/SLA persistence beyond diagnostic-only UI
- completed tenant-aware docs ingestion path for backend dev runtime
- completed E2E regression for curated knowledge creation in admin settings
- completed supervisor reroute flow in admin inbox
- completed first approval-only retrieval layer for AI runtime
- completed action-specific confirmation guidance baseline for `admin_internal`
- completed persisted embedding layer and manual reindexing workflow for approved knowledge retrieval
- completed hybrid retrieval ranking in backend and AI runtime integration against the internal retrieval contract
- completed stabilization of AI conversation QA block after fixing internal-chat selection/response races
- completed impact analysis of the external `dreamschat-v2.8.4` messaging template for future admin/storefront reuse decisions
- started the parallel `Conversations`/`Conversations V2` migration strategy so the new layout can move forward without overwriting the current operational view immediately
- copied the required chat visual assets from the external template into the current repo under `frontend/public/mock/dreamschat`
- switched the principal admin conversations route to the new template-driven React reimplementation while keeping the previous view available as `Conversations V2`
- validated the new principal route against local image/audio/video/attachment assets with passing E2E coverage

## Risks Being Managed

- duplication between `Inbox*` and `Conversation*`
- regression risk in CRM operational surfaces
- channel/UI divergence between email inbox and conversation inbox
- configuration drift between backend secure config and AI runtime service instances
- provider-specific delivery coverage for Meta channels still depends on credentials/webhooks not yet available in this environment
- knowledge extracted from conversations must not become trusted retrieval input without curation and PII controls
- provider-backed delivery status for real Meta/email webhooks still needs tenant credentials and inbox onboarding per client
- retrieval is approval-aware and now uses a local persisted vector projection, but still lacks provider-backed embeddings and async indexing
- auto-assignment is available for least-loaded queues, while weighted routing/escalation policies are still pending
- weighted routing / SLA escalation / richer ownership remain recommendations, not current acceptance scope for this slice
- exploratory testing should start only once the admin messaging surface feels visually coherent for the main message types, not only technically functional
- there is still no internal shared messaging component layer; the external template analysis confirms that direct import would add more risk than value
- email inbox can currently diverge from webmail history because sync is recent-window based and not yet historical/cursor-complete
- email and conversations still use partially different grouping sources; the canonical contract is now defined, but backend-first convergence is still in progress
- email thread grouping is now backend-driven at message identity level, but the `Emails` surface still needs a dedicated canonical thread list endpoint to fully stop grouping in UI state
- email thread identity is now available as a canonical backend thread list and the admin `Emails` surface already consumes it as the primary list model
- mailbox history can now be completed from admin UI, although the full operator experience around deep history still needs refinement
- mailbox history sync can now resume from stored cursor state instead of always starting again from the top
- protection posture still needs an explicit endpoint-by-endpoint audit even though global throttling, CORS and guards already exist
- the new audit matrix shows the highest-priority hardening areas today are `ai-agent-service`, `channel-adapter`, and backend operational surfaces such as `conversations`, `ai` and `inbox`

## Next Steps

1. Finish the visual closure of the admin messaging surface on top of the already working basic flow:
   - mailbox sync now
   - complete history
   - canonical thread grouping
   - read/reply over backend-first thread list
   - message types rendered cleanly in transcript
2. Run exploratory testing on the admin messaging surfaces and capture changes/needs
3. Keep `ownership / routing / SLA` as documented follow-up recommendations after exploratory validation
4. Execute `P0` endpoint hardening audit before broader channel expansion
6. Execute `P2` AI quality improvements:
   - provider-backed embeddings
   - async reindex jobs
   - retrieval observability
7. Revisit cross-channel merge hardening after the admin email flow and later operational hardening are stronger
8. Leave storefront messaging rollout for `P3`, after admin messaging is considered closed enough both in logic and UI
# 2026-03-25

## What Was Done

- fixed inbox email polling so configured accounts sync automatically on backend boot
- corrected inbox email config precedence so secure config stored in database is authoritative when present
- prevented blank env values from collapsing inbox numeric defaults to `0`
- created the first shared messaging primitive layer in:
  - [frontend/src/components/messaging](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/components/messaging)
- refactored admin conversations to consume those primitives for shell, header, list rows, transcript bubbles and composer
- documented the storefront split:
  - public chat without persistence and restricted access
  - logged-in customer chat with persistence and customer-safe access

## Current Status

- inbox email config now resolves correctly from DB for the configured account
- backend boot now triggers an immediate inbox sync and then continues with timed polling
- admin conversations no longer depend only on a monolithic view component for core messaging layout

## Next Steps

- extend the shared messaging primitives into storefront-safe consumers
- keep admin-specific controls outside the primitive layer
- continue with inbox ownership/SLA evolution and retrieval improvements
