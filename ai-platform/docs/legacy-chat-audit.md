# Legacy Chat Audit

Date: 2026-04-03

Scope:
- Branch audited: `develop`
- Objective: identify which parts of the abandoned legacy chat/runtime are useful as reference for the new standalone conversational platform in `/ai-platform`, and which parts must not be carried forward because they violate the new architecture rules.

## Executive Summary

The legacy implementation is valuable as a source of domain knowledge, parsing heuristics, response safety ideas, role/tool catalogs, and QA assets. It is not valid as a runtime architecture template for the new platform.

Main conclusion:
- Do not migrate `services/ai-agent-service` as a whole.
- Do not port the legacy orchestration loop, provider integration, or tool execution model.
- Do selectively reimplement isolated concepts and pure helpers where they fit the new layer model:
  - interpretation support
  - parsing normalization
  - tenant/business policy modeling
  - response guardrails
  - observability and QA

The legacy system failed mostly because too much responsibility accumulated inside a single AI runtime. The new platform must keep those concerns separated and backend-controlled.

## Evidence Reviewed

Primary legacy runtime files reviewed on `develop`:
- `services/ai-agent-service/src/ai/agent.js`
- `services/ai-agent-service/src/ai/model/openai-provider.js`
- `services/ai-agent-service/src/ai/nlp/analyze-message.js`
- `services/ai-agent-service/src/ai/nlp/generate-response.js`
- `services/ai-agent-service/src/ai/should-call-ai.js`
- `services/ai-agent-service/src/ai/conversation/canonical-intermediate-contract.js`
- `services/ai-agent-service/src/ai/conversation/conversation-state.js`
- `services/ai-agent-service/src/ai/conversation/decision-runtime.js`
- `services/ai-agent-service/src/ai/conversation/response-resolver.js`
- `services/ai-agent-service/src/ai/conversation/turn-controller.js`
- `services/ai-agent-service/src/ai/tenant-policy/runtime-tenant-policy.js`
- `services/ai-agent-service/src/ai/roles/role-runtime.js`
- `services/ai-agent-service/src/ai/security/sanitize-input.js`
- `services/ai-agent-service/src/ai/guardrails/validate-response.js`
- `services/ai-agent-service/src/ai/model/provider-call-trace.js`
- `services/ai-agent-service/src/ai/grounding/grounding-audit.js`
- `services/ai-agent-service/src/ai/ingress/customer-turn-normalization.js`
- `services/ai-agent-service/src/ai/message-elements/interpret-message-elements.js`
- `services/ai-agent-service/src/ai/nlu/customer-measurement-parser.js`
- `services/ai-agent-service/src/ai/memory/redis-conversation-store.js`

Legacy backend and integration files reviewed on `develop`:
- `backend/src/ai/ai.service.ts`
- `backend/src/ai/ai.controller.ts`
- `backend/src/ai/role-engine/role.config.ts`
- `backend/src/ai/role-engine/role-policies.ts`
- `backend/src/ai/role-engine/role-resolver.ts`
- `backend/src/conversations/conversations.service.ts`
- `backend/src/conversations/conversations.controller.ts`
- `backend/src/knowledge/knowledge.service.ts`
- `services/channel-adapter/src/channels/webchat/webchat.adapter.js`
- `services/channel-adapter/src/clients/ai-agent.client.js`

Legacy tests and design docs reviewed on `develop`:
- `services/ai-agent-service/src/ai/__tests__/customer-runtime-core-contracts.test.js`
- `services/ai-agent-service/src/ai/__tests__/customer-runtime-multitenant-smoke.test.js`
- `services/ai-agent-service/src/ai/conversation/__tests__/canonical-intermediate-contract.test.js`
- `docs/ai-agent-runtime-blueprint.md`
- `docs/ai-agent-foundation-implementation.md`

## Auditor Verdict

Verdict:
- Useful as reference: `YES`
- Safe to copy directly: `LIMITED`
- Safe to use as architectural template: `NO`

Reason:
- The legacy stack contains good local solutions to real problems such as contextual follow-up handling, quote/schedule/support progression, multimodal normalization, response shaping, and evaluation.
- The runtime boundary is wrong for the new system. The legacy service lets AI participate in decisions and, in one path, directly execute tools. That is incompatible with the new platform rules.

## What The Legacy System Solved Well

### 1. Rich intermediate conversation state

Useful concepts:
- canonical intermediate contract
- compact conversation state
- thread/lane continuity
- stale fact invalidation when a lane changes
- next-useful-field tracking

Why it matters:
- The abandoned runtime clearly invested in conversational continuity and avoided stateless intent handling.
- This is directly relevant to the new platform, especially for quote, booking, and support-style flows where follow-up turns must preserve context without re-asking everything.

What to do with it:
- Reimplement the concepts as backend-native contracts after interpretation/parsing.
- Do not reuse the exact giant object model from the legacy runtime.
- Keep the new contract smaller and stage-specific.

Main reference files:
- `services/ai-agent-service/src/ai/conversation/canonical-intermediate-contract.js`
- `services/ai-agent-service/src/ai/conversation/conversation-state.js`

### 2. Strong tenant/domain vocabulary modeling

Useful concepts:
- topic taxonomy
- quote profiles
- vocabulary and synonym registries
- business fact bundles
- business rules such as payment methods and installation terms

Why it matters:
- The legacy runtime encoded tenant-aware domain knowledge in a structured way, instead of relying only on prompting.
- That is the correct direction for the new platform.

What to do with it:
- Treat these as sources for the new tenant config, knowledge, and prompt versioning strategy.
- Move them behind backend-managed tenant configuration and knowledge services.
- Keep tenant resolution automatic; do not pass `tenantKey` manually through runtime hops.

Main reference files:
- `services/ai-agent-service/src/ai/tenant-policy/runtime-tenant-policy.js`
- `backend/src/knowledge/knowledge.service.ts`

### 3. Good parsing and ingress heuristics

Useful concepts:
- customer turn cleanup
- multimodal placeholder stripping
- extracted attachment text normalization
- measurement and dimension parsing
- quote profile attribute capture hints

Why it matters:
- These are exactly the kinds of deterministic helpers the new Parsing layer should own.

What to do with it:
- Reimplement or selectively port pure parsing helpers into `/ai-platform/backend/src/modules/parsing`.
- Keep them backend-deterministic and independent from LLM decisions.

Main reference files:
- `services/ai-agent-service/src/ai/ingress/customer-turn-normalization.js`
- `services/ai-agent-service/src/ai/message-elements/interpret-message-elements.js`
- `services/ai-agent-service/src/ai/nlu/customer-measurement-parser.js`

### 4. Response safety and wording controls

Useful concepts:
- approved-draft rewrite instead of freeform generation
- response guardrails for length and question requirements
- grounding audit
- provider call budget tracing

Why it matters:
- The legacy runtime had real controls to prevent low-quality or ungrounded output.
- Those controls are useful if they are moved to the correct layer.

What to do with it:
- Use them only in the Response layer, after backend decision/tool execution is complete.
- Preserve the principle: AI may improve wording, but not decide actions.

Main reference files:
- `services/ai-agent-service/src/ai/nlp/generate-response.js`
- `services/ai-agent-service/src/ai/guardrails/validate-response.js`
- `services/ai-agent-service/src/ai/model/provider-call-trace.js`
- `services/ai-agent-service/src/ai/grounding/grounding-audit.js`

### 5. Role and tool permission catalogs

Useful concepts:
- role-specific allowed tool lists
- confirmation requirements
- exposed field filtering
- explicit customer vs admin role separation

Why it matters:
- The legacy backend already moved part of permissioning into deterministic config.
- That is aligned with the new platform’s backend-owned execution rule.

What to do with it:
- Reuse the role/tool matrix as source material for future admin/internal tooling.
- Keep the authoritative permission check in the backend, not in the model runtime.

Main reference files:
- `backend/src/ai/role-engine/role.config.ts`
- `backend/src/ai/role-engine/role-policies.ts`

### 6. QA and regression assets

Useful concepts:
- synthetic multitenant smoke tests
- canonical contract tests
- real corpus QA tooling
- closure and grounding checks

Why it matters:
- These assets are probably the most transferable legacy investment.
- They can accelerate validation of the new runtime once the new stage-by-stage architecture is wired.

What to do with it:
- Reuse datasets, scenarios, and assertions.
- Repoint them to the new `/ai-platform` pipeline gradually.

Main reference files:
- `services/ai-agent-service/src/ai/__tests__/customer-runtime-core-contracts.test.js`
- `services/ai-agent-service/src/ai/__tests__/customer-runtime-multitenant-smoke.test.js`
- `tools/qa/*`

## Critical Architectural Defects In The Legacy Runtime

### P0. LLM tool execution inside the provider

Observed:
- The legacy `OpenAIProvider.generate()` binds tools to the model, allows model-produced tool calls, executes those tools, and feeds tool outputs back into a second model call.

Why this is invalid for the new platform:
- It violates the non-negotiable rule that the LLM cannot execute tools.
- It also weakens auditability because decision and execution are coupled to model behavior.

Main reference file:
- `services/ai-agent-service/src/ai/model/openai-provider.js`

Carry-forward rule:
- Never reuse this execution pattern.
- The new `AiGatewayModule` may call the model only for interpretation or final wording generation.

### P0. Prompt-driven decision assistance

Observed:
- The legacy runtime included explicit decision prompts that ask the model to recommend the next action.
- The runtime also mixes heuristic, NLU, and model-assisted interpretation into a composite next-step decision path.

Why this is invalid for the new platform:
- The new platform requires deterministic backend decisioning.
- The model may interpret, but it may not own routing, clarification policy, or action selection.

Main reference files:
- `services/ai-agent-service/src/ai/prompts/decision.prompt.js`
- `services/ai-agent-service/src/ai/nlp/analyze-message.js`
- `services/ai-agent-service/src/ai/conversation/decision-runtime.js`

Carry-forward rule:
- Only keep model-assisted extraction.
- Convert all decision policies into backend code.

### P0. Monolithic orchestration runtime

Observed:
- `AiAgentRuntime` is a very large orchestration object combining ingress normalization, classification, memory, retrieval, decisioning, response shaping, audit construction, and tool handling.

Why this is invalid for the new platform:
- It mixes the layers that the new architecture explicitly separates.
- It makes regression isolation, observability, and correctness hard.

Main reference file:
- `services/ai-agent-service/src/ai/agent.js`

Carry-forward rule:
- Do not port this runtime.
- Only extract isolated pure utilities.

### P1. Multi-tenant isolation is not automatic

Observed:
- Tenant resolution in the legacy stack is frequently payload-driven or query-driven through `tenantKey`.
- Redis conversation memory keys are built only from `conversationId`.

Why this is risky:
- It depends on callers passing correct tenant context.
- It does not meet the new platform rule that tenant isolation must be automatic and not manual.

Main reference files:
- `services/ai-agent-service/src/clients/backend-ai.client.js`
- `backend/src/ai/ai.controller.ts`
- `services/ai-agent-service/src/ai/memory/redis-conversation-store.js`

Carry-forward rule:
- Keep the tenant/business policy concept.
- Reject the old tenant propagation model.

### P1. Backend business logic is split between services

Observed:
- The legacy backend exposes AI-oriented business endpoints and permissions, but a large amount of runtime flow logic still lives in the external AI service.

Why this is risky:
- Domain rules become duplicated or drift apart.
- The system becomes harder to evolve safely because backend truth and AI runtime behavior can diverge.

Main reference files:
- `backend/src/ai/ai.service.ts`
- `backend/src/ai/role-engine/*`
- `services/ai-agent-service/src/ai/roles/role-runtime.js`

Carry-forward rule:
- Centralize decision, permissions, and execution in the new backend.
- Use the AI gateway only as a text/interpretation boundary.

### P1. Observability is rich but not stage-canonical

Observed:
- The legacy runtime produces extensive audit payloads, grounding metadata, and decision traces.
- The trace is not organized as the new required pipeline stages with strict stage ownership.

Why this is risky:
- Diagnostics exist, but not in the exact shape required for the new platform:
  `input -> interpretation -> parsing -> decision -> execution -> response`.

Main reference files:
- `services/ai-agent-service/src/ai/model/provider-call-trace.js`
- `services/ai-agent-service/src/ai/grounding/grounding-audit.js`
- `services/channel-adapter/src/channels/webchat/webchat.adapter.js`

Carry-forward rule:
- Reuse the observability ideas.
- Rebuild them around `ChatLog` stage persistence in the standalone backend.

### P2. Duplication and drift

Observed:
- Role catalogs exist both in backend and runtime forms.
- Blueprint docs describe a cleaner structure than the actual runtime ended up with.
- Runtime aliases and action mappings accumulated over time.

Why this is risky:
- It increases operational ambiguity and slows safe iteration.

Main reference files:
- `backend/src/ai/role-engine/role.config.ts`
- `services/ai-agent-service/src/ai/roles/role-runtime.js`
- `docs/ai-agent-runtime-blueprint.md`

Carry-forward rule:
- One contract per concern.
- No duplicated role/tool definitions across layers.

## Reimplementable Legacy Assets

These are the highest-value legacy assets for the new platform.

| Legacy Asset | Reuse Mode | New Target Layer |
| --- | --- | --- |
| `customer-turn-normalization.js` | Reimplement concepts | Parsing / ingress normalization |
| `interpret-message-elements.js` | Reimplement concepts | Parsing / multimodal preprocessing |
| `customer-measurement-parser.js` | Selective port/rewrite | Parsing |
| `canonical-intermediate-contract.js` | Mine fields and semantics only | Parsing -> Decision handoff DTOs |
| `conversation-state.js` | Reimplement reduced state model | Memory + deterministic decision support |
| `runtime-tenant-policy.js` | Reuse data model ideas | Tenant config + knowledge services |
| `role.config.ts` and `role-policies.ts` | Reuse policy ideas | Backend authorization / tool policy |
| `generate-response.js` | Reimplement approved-draft rewrite concept | Response layer |
| `validate-response.js` | Reimplement | Response guardrails |
| `provider-call-trace.js` | Reimplement | Logging / observability |
| `grounding-audit.js` | Reimplement | Response logging / QA |
| legacy tests and `tools/qa` | Reuse scenarios and corpora | Validation and regression suite |

## Assets That Must Not Be Reused Directly

Do not port these files or patterns into the new standalone platform:
- `services/ai-agent-service/src/ai/agent.js`
- `services/ai-agent-service/src/ai/model/openai-provider.js`
- `services/ai-agent-service/src/ai/prompts/decision.prompt.js`
- `services/ai-agent-service/src/ai/roles/role-runtime.js`
- `services/ai-agent-service/src/clients/backend-ai.client.js` tenant propagation model
- `services/ai-agent-service/src/ai/memory/redis-conversation-store.js` keying strategy

Reason:
- They encode exactly the coupling that the new architecture is meant to eliminate.

## Recommended Legacy Mining Order

When future implementation prompts need to reuse legacy work, follow this order:

1. Parsing and ingress helpers
   - measurement parsing
   - text cleanup
   - message element interpretation
2. Tenant/domain configuration concepts
   - topic taxonomy
   - quote profiles
   - business facts and vocabulary
3. Reduced deterministic conversation state concepts
   - next useful field
   - stale fact invalidation
   - lane continuity
4. Response safety concepts
   - approved-draft rewrite
   - guardrails
   - grounding audit
5. QA assets
   - corpora
   - multitenant smoke cases
   - closure and grounding checks
6. Admin/internal role and tool policy
   - only when admin/internal tooling is implemented in the new backend

## Future Prompt Guardrails

Use these rules in future implementation prompts:

- The legacy system may be referenced, but not copied wholesale.
- Any proposed reuse must explicitly answer:
  - Which new layer owns this behavior?
  - Does the backend remain the sole decision owner?
  - Does the backend remain the sole tool executor?
  - Is tenant isolation automatic?
  - Can the result be logged in a stage-specific `ChatLog` record?
- If any answer is `no`, do not port that legacy pattern.

## Roadmap Planning Rule

Use this audit not only during implementation, but also when shaping the roadmap itself.

Planning rule:
- Future roadmap waves must explicitly consider whether the legacy chat already solved part of the same problem in a reusable way.
- Legacy solutions should be mined when they can be reimplemented cleanly inside the new architecture, especially for:
  - runtime-managed resource governance
  - deterministic conversation state and follow-up continuity
  - response safety and approved-draft controls
  - admin test tooling and QA flows
  - user-facing chat experience concepts
- Legacy reference must inform sequencing, but must not force migration of invalid architectural patterns.

Decision rule for future planning:
- Before opening a new roadmap wave, check whether the legacy audit contains:
  - a reusable concept
  - a reusable validation asset
  - a reusable admin or operator workflow idea
- If it does, incorporate that reference into the roadmap narrative and implementation scope.
- If the legacy solution depends on model-owned decisions, provider-owned tool execution, monolithic orchestration, or manual tenant routing, keep it out of the roadmap implementation path.

Roadmap consequence:
- The legacy codebase is a mandatory reference source for future iteration design.
- It remains a mined reference library, not a migration template.

## Concrete Guidance For The New Standalone Platform

### Safe to reimplement early

- measurement and dimension normalization
- attachment/message-element preprocessing
- quote profile and topic taxonomy modeling
- provider-call budget / tracing ideas
- response guardrails

### Safe to reimplement only after the deterministic backend path exists

- compact conversation state
- next-useful-field logic
- response rewriting over approved drafts
- grounding audit
- retrieval gating

### Must stay out of the new platform

- model-driven next-step decisions
- provider-owned tool execution
- monolithic orchestration services
- manual tenant routing by payload/query

## Final Conclusion

The legacy chat system should be treated as a mined reference library, not as a migration candidate.

Best use:
- extract pure parsing and policy ideas
- reuse QA and regression assets
- reuse structured tenant/domain concepts
- reuse response-safety patterns

Worst use:
- copying the runtime loop
- copying the provider/tool execution flow
- copying the decision-assist prompt model

This audit should be the default reference whenever future prompts ask whether a legacy chat solution should be ported into `/ai-platform`.
