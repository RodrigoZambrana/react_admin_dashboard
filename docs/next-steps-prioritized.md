# Prioritized Next Steps

## Goal

Turn the current pending work into an execution order that is:

- prioritized
- dependency-aware
- easy to resume

This document is the short operational guide for the next implementation slices.

## Current Priority Order

The strategic buckets remain `P0` to `P3`, but the immediate execution order chosen for the next slices is:

1. close `P1` admin messaging logic and operational behavior
2. apply the new messaging visual language inside admin to give the inbox a stronger product-level closure
3. continue with `P0` endpoint hardening follow-up before expanding more external channel surface
4. continue with `P2`
5. leave `P3` for later

### P0 — System-wide endpoint protection audit

Objective:

- verify minimum protections before expanding more externally reachable surfaces

Scope:

- backend
- frontend/admin exposed handlers
- storefront route handlers
- `services/ai-agent-service`
- `services/channel-adapter`

Required outcome:

- endpoint groups classified as `covered / partial / pending`
- gaps converted into actionable implementation items

Tracking source:

- [endpoint-protection-audit-matrix.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/endpoint-protection-audit-matrix.md)

Why first:

- this is the acceptance gate before continuing channel expansion
- the highest-risk exposed surfaces today are `ai-agent-service`, `channel-adapter`, `backend/src/conversations`, `backend/src/ai` and `backend/src/inbox`

### P1 — Close admin messaging behavior and operational reliability

Objective:

- finish the admin messaging product before extending it to storefront

Includes:

- email historical backfill per mailbox
- canonical backend thread list for `Emails`
- full convergence of `Emails` toward the canonical messaging contract
- consistent ordering so revived threads move to the top
- document `ownership / routing / SLA` as the next recommended hardening layer after exploratory validation

Required outcome:

- admin inbox becomes the canonical operational messaging surface
- email, conversations and multichannel flows behave consistently

Why second:

- this is the most immediate product surface for operators
- storefront messaging should not be expanded until admin messaging is coherent

### P1.5 — Visual closure of admin messaging

Objective:

- incorporate the stronger messaging layout/style direction from the analyzed external template into the admin inbox after the admin messaging behavior is already closed

Includes:

- refine the admin messaging shell
- apply the new visual language to list/detail/transcript/composer patterns
- preserve responsive behavior already validated in mobile and desktop
- avoid direct code import; use the template only as a style and interaction reference

Required outcome:

- admin messaging ends this phase with both logic and UI/UX closure
- the admin inbox becomes the visual reference before any storefront rollout

Why here:

- styling should not lead the behavior
- once logic is stable, a focused UI pass is safer and gives the messaging work a cleaner closure

### P2 — Improve AI operational quality on top of the stable inbox

Objective:

- improve answer quality and safe execution once the operator workflow is reliable

Includes:

- provider-backed embeddings
- async reindex jobs
- retrieval observability
- snippet feedback loop
- richer candidate review workflow
- better ranking and retrieval diagnostics
- stronger confirmation UX for high-impact `admin_internal` actions

Required outcome:

- AI answers become more reliable without widening the trust boundary

Why after P1:

- better retrieval is valuable, but it should not outrank operational correctness of the inbox

### P3 — Storefront messaging rollout

Objective:

- reuse the shared messaging primitives only after admin messaging is stable

Includes:

- public chat without persistence and without privileged access
- logged-in customer chat with persisted history and scope-limited access

Rule:

- this slice starts only after admin messaging logic and UX are considered closed enough

## Recommended Execution Sequence

1. Finish the admin messaging closure baseline:
   - `Emails` consuming backend threads instead of frontend grouping
   - mailbox sync controls (`Sync now` and `Complete history`)
   - complete/partial visibility and thread readability
   - read/reply over the canonical thread list
   - transcript rendering for text, attachment, image and audio with the new layout language
   - exact parity pass on list, header, composer and detail drawer in the principal route
   - keep `Mensajes` as the global entry point while the contextual messaging rail drives in-section actions
   - keep global new-chat, in-chat search and channels/inboxes navigation stable during migration
2. Run exploratory testing on admin messaging and capture gaps
3. Apply the visual closure pass for admin messaging using the external template as design reference only
4. Keep `ownership / routing / SLA` as the next hardening layer after exploratory validation:
   - weighted routing
   - escalation
   - reassignment
   - supervision metrics
5. Complete P0 audit matrix and convert the highest-risk `pending` groups into implementation tasks
6. Improve AI quality:
   - provider embeddings
   - async indexing
   - retrieval observability
7. Revisit cross-channel merge hardening once admin messaging is closed enough logically and visually
8. Only then start storefront messaging rollout

## Blockers And Dependencies

### Storefront messaging depends on:

- shared messaging primitives remaining stable in admin
- canonical thread and ordering behavior already closed in admin
- endpoint protection audit completed for storefront-safe contracts

### External channel growth depends on:

- channel-adapter hardening
- webhook validation strategy
- rate limiting strategy
- internal/external boundary review

### Better AI retrieval depends on:

- approved knowledge corpus staying curated
- retrieval telemetry and operator review remaining observable

## Short Resume Plan

If work resumes after a pause, the recommended restart point is:

1. open [next-steps-prioritized.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/next-steps-prioritized.md)
2. open [tasks.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/tasks.md)
3. continue with the current `P1` closure item
