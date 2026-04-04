# Corpus Distillation Report

## Purpose

This report captures how the real-message corpus and the legacy runtime are distilled into:

- reusable core conversational patterns
- explicit tenant capability behavior patterns
- regression fixtures and tests

The corpus is not active runtime knowledge.

The running platform must continue to use:

- approved tenant resources
- managed documents
- managed catalogs
- other governed tenant-scoped truth

The real corpus remains analysis and regression input only.

## Source Material Reviewed

- `/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/index.json`
- `/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/proposals/*.json`
- `/Users/rodrigo/git/personal/react_admin_dashboard/.qa/runs/real-corpus-replay-*/diagnostic.md`
- `/Users/rodrigo/git/personal/react_admin_dashboard/.qa/runs/real-corpus-replay-*/readable.md`
- `/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/conversation/*`

## Distillation Rule

Promote a pattern into core only if it is:

- reusable across tenants
- conversational or orchestration-related
- independent from one business domain
- useful even when no tenant capability module is active
- representable as backend-owned state, continuity, grounding, closure, or noise filtering

Keep a pattern out of core when it is:

- quote / measurements behavior
- appointment scheduling behavior
- product-catalog business behavior
- pricing, hours, payment, references, or policy truth
- any tenant-specific sales or operational workflow

## High-Signal Corpus Findings

The corpus is rich in business-heavy flows, but the reusable value is mostly in the conversational mechanics around them.

High-frequency labels observed in the current corpus include:

- `quote_request`
- `structured_measurements`
- `appointment_scheduling`
- `long_running_thread`
- `operational_thread_switch`
- `reengagement_after_gap`
- `system_message_interference`
- `auto_reply_present`
- `multimodal_image`

Important conclusion:

- `quote_request`, `structured_measurements`, and `appointment_scheduling` are frequent
- they still remain tenant capability behavior patterns
- frequency in `urucortinas` is not evidence that those behaviors belong in the reusable core runtime

## Promoted Core Patterns

The current `runtime-general` fixtures promote only these reusable patterns into the core backlog and regression suite:

- follow-up continuity without reopening intake
- re-engagement after a gap
- operational thread switching
- contextual closure
- system-message / auto-reply interference filtering
- long-running thread carryover
- loop prevention when no structural progress occurs
- attachment/noise awareness without treating the attachment as business truth by itself

These patterns are now represented in:

- `/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/test/fixtures/real-corpus/runtime-general`
- `/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/test/corpus-derived/runtime-general-distillation.spec.ts`

## Explicitly Non-Core Patterns

The following labels remain outside the core runtime, even when they appear inside conversations that also reveal reusable conversational mechanics:

- `quote_request`
- `structured_measurements`
- `appointment_scheduling`
- `quote_follow_up`
- `payment_terms`
- `technical_advice`

These may inform:

- tenant capability modules
- tenant resource ingestion priorities
- future tenant overlays

They must not silently re-enter:

- core prompt defaults
- decisive core routing
- fallback wording
- shared continuity logic

## Legacy Runtime Distillation

The old `services/ai-agent-service` runtime is used only as conceptual input.

Useful ideas kept at the architectural level:

- contextual closure should depend on state, not one raw gratitude token
- thread switching and resume are distinct from generic follow-up
- loop prevention must read structural progress, not only wording similarity
- response wording should remain separate from runtime state/control

Patterns not ported:

- monolithic orchestration
- monolithic regex-driven conversation ownership
- tenant/business heuristics embedded in shared runtime code
- provider-owned execution decisions

## Operational Outcome

After this distillation step:

- the core platform owns reusable conversational mechanics
- tenant capabilities remain modular business workflows
- tenant resources remain the approved source of business truth
- the real corpus is locked as regression evidence only

This preserves multilingual and multi-tenant evolution without allowing one tenant corpus to redefine the core runtime.
