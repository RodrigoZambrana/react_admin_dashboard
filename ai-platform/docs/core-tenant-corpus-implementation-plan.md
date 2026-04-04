# Core, Tenant, And Real-Corpus Implementation Plan

## Objective

Concentrate the latest architectural agreements before the next implementation phase so the platform can evolve without reopening already closed work or adding new vocabulary/regex debt.

This document exists to align the next conversational iterations around:

- a clear split between core platform behavior and tenant behavior
- the locked distinction between:
  - core platform
  - tenant capability modules
  - tenant resources
- correct use of the real-message corpus as a pattern-analysis source only
- preservation of the good document-grounded and advisory behavior already achieved
- explicit avoidance of new inline lexical or wording debt in decisive paths

The authoritative boundary summary now also lives in:

- `docs/core-tenant-boundaries.md`

## Current State To Preserve

The following work is already considered achieved and must remain intact unless a compatibility-safe update is strictly required by the new logic:

- exploratory runtime with real OpenAI-backed operation
- async public chat foundation
- admin document ABM
- document-origin retrieval separated from runtime-learned knowledge
- stable document and advisory multi-turn continuity
- honest demo `get_product` boundary with fail-closed behavior
- combined document + booking flows that remain grounded and avoid fake product/catalog claims
- structured conversation-signal ownership moved out of inline decisive-service regex arrays

The next work must build on that base rather than reopen it.

## Architecture Taxonomy

### Core Platform

Core is the reusable conversational substrate that every tenant should inherit.

Core includes:

- conversational baseline behavior
- async intake and turn projection
- continuity and follow-up handling
- contextual clarification discipline
- source selection and grounding
- fact versus bounded inference versus unspecified-detail behavior
- contextual close-turn behavior
- advisory continuity
- document continuity
- loop prevention
- thread switching and re-engagement handling
- channel-noise filtering
- observability and traceability
- document processing capability
  - document ingestion
  - chunking
  - retrieval
  - grounded synthesis over approved document context

This core list must remain architecture-owned rather than corpus-owned:

- corpus frequency can reveal where the platform is weak
- corpus frequency does not redefine what becomes core

Important clarification:

- document processing is core
- uploaded document content is not core truth
- documents remain tenant-scoped resources even though the capability that processes them is part of the core platform

### Tenant Capability Modules

Tenant capability modules are optional business-flow capabilities layered on top of the conversational core.

These should remain modular because the product is intended for SaaS use across multiple tenants, each inheriting the same core but enabling different business capabilities.

Examples:

- booking / scheduling
- quote / estimation
- structured measurements intake
- product catalog lookup
- support / post-sale
- payment/purchase-flow assistance
- any other business workflow that is not part of the generic conversational substrate

Important clarification:

- these capabilities are not core just because they appear frequently in one tenant corpus
- frequency in `urucortinas` conversations does not make them globally reusable runtime behavior
- the current product may operate with one tenant, but the architecture must continue to model these as tenant capability modules, not as universal core logic
- corpus-derived labels such as `quote_request`, `structured_measurements`, and `appointment_scheduling` are tenant capability behavior patterns, not proof of core behavior

### Tenant Resources

Tenant resources are the tenant-scoped sources of business truth consumed by the core platform and/or tenant capability modules.

Examples:

- uploaded documents
- product catalogs
- pricing
- payment terms
- business hours
- commercial references
- policies
- support constraints
- any tenant-specific approved content

Important clarification:

- these resources must not be hardcoded into core logic
- but if they are present in approved tenant resources, the chat must be able to process and use them
- for example:
  - pricing in an uploaded document may be used as document-grounded truth
  - hours in a tenant policy resource may be used as approved truth
  - catalog attributes in a tenant catalog resource may be used by a tenant product capability

## Role Of The Real Corpus

The real-message corpus under:

- `/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp`
- `/Users/rodrigo/git/personal/react_admin_dashboard/.qa/runs`

must be treated as:

- a pattern-analysis source
- a regression-fixture source
- a planning input for reusable logic

It must not be treated as:

- active conversational knowledge
- a document corpus for runtime retrieval
- a source of truth for tenant facts unless those facts are independently loaded as approved tenant resources
- a library of wording snippets to patch into the runtime

### What The Corpus Is Good For

The corpus is useful for deriving:

- continuity patterns
- re-engagement patterns
- operational thread switches
- clarification failure patterns
- loop-reentry patterns
- closure behavior patterns
- channel-noise handling patterns
- attachment handling expectations
- regression cases for follow-ups and state persistence

### What The Corpus Must Not Be Used For

The corpus must not be used to directly inject:

- operator wording
- tenant pricing
- commercial references
- product facts
- payment terms
- scheduling/hours details
- product-specific policies

unless those facts are later loaded into explicit approved tenant resources through the governed platform.

## Corpus-Derived Classification Criteria

Before incorporating any pattern from the real corpus, classify it using the following decision rule.

### Promote To Core Platform Only If

The pattern is:

- reusable across tenants
- not dependent on one product family or one business domain
- fundamentally conversational or orchestration-related
- useful even when no tenant capability module is active
- expressible as backend-owned conversational behavior rather than business knowledge

Examples:

- follow-up continuity
- loop prevention
- partial-information handling
- close-turn in context
- re-engagement after gap
- switching from exploratory flow to operational flow
- filtering channel noise
- preserving already-captured facts

### Promote To Tenant Capability Module If

The pattern is:

- a business-flow behavior
- reusable across multiple tenants only when that capability exists
- not part of the generic conversational substrate

Examples:

- quote intake progression
- measurement capture
- appointment scheduling
- support-resolution handoff patterns
- product-catalog lookup behavior

### Keep As Tenant Resource Only If

The item is:

- factual business content
- commercial policy
- product detail
- pricing
- availability
- reference list
- hours
- payment or billing data
- any tenant truth that should be loaded from governed resources instead of encoded in logic

## What The Existing Corpus Already Tells Us

The current corpus processing already supports this split and should be reused as analysis input rather than bypassed:

- `generalRuntimeLabels` in the corpus index and proposals are useful seeds for reusable behavior
- `tenantSpecificLabels` already show that some material belongs outside the core runtime
- proposal files are already a better input than raw transcripts because they summarize:
  - rationale
  - expected behaviors
  - scope

Important clarification:

- labels such as `quote_request`, `structured_measurements`, and `appointment_scheduling` are not evidence that those behaviors belong in the core platform
- they are evidence that those behaviors are frequent in the current tenant corpus
- the reusable value from those conversations is often in the conversational mechanics around them, not in the business flow itself

## Guardrails For The Next Implementation

The next phase must not:

- add new inline regex debt in decisive services
- add new hardcoded vocabulary arrays in routing/decision/retrieval logic
- encode tenant product/payment/hours knowledge in core logic
- use one tenant corpus as if it defined the universal product behavior
- degrade the already-good document-grounded response quality
- regress document/advisory continuity

Lexical support remains allowed only if:

- it is housed in a clear backend-owned boundary
- it has a defined purpose
- it is maintainable
- it is test-covered
- it does not become the sole routing truth

## Implementation Plan

### Phase 1: Corpus Distillation And Boundary Audit

Goal:

- review the existing corpus artifacts and produce a final distilled inventory of:
  - reusable core patterns
  - tenant capability patterns
  - tenant resource content

Deliverables:

- documented classification table
- list of patterns approved for incorporation into core logic
- list of patterns approved for future tenant-capability work
- explicit exclusion list of tenant wording/content that must not enter core logic

Primary sources:

- `.qa/external-real-conversations/whatsapp/index.json`
- `.qa/external-real-conversations/whatsapp/proposals/*.json`
- `.qa/runs/real-corpus-*/diagnostic.*`
- legacy conversation-state/readiness/contract code as reference only

### Phase 2: Translate Reusable Corpus Patterns Into Current Architecture

Goal:

- map the approved reusable patterns into the current `ai-platform` architecture without porting legacy code directly

Target areas:

- continuity
- contextual closure
- grounding fidelity
- fact/inference/unspecified distinction
- loop prevention
- follow-up handling
- re-engagement after gaps
- thread-switch behavior

Constraint:

- everything must be translated into the current stage-separated backend model
- do not import the monolithic legacy orchestration shape

### Phase 3: Formalize Tenant Capability Module Boundaries

Goal:

- make the SaaS-ready separation explicit between:
  - core platform
  - tenant capability modules
  - tenant resources

Initial tenant capability modules to keep explicit:

- booking
- quote
- structured measurements
- product catalog lookup
- support/post-sale

Constraint:

- do not merge these capabilities into the conversational core just because one tenant uses them heavily

### Phase 4: Corpus-Derived Regression Suite

Goal:

- convert approved `runtime_general` proposals into backend regression fixtures

Priority areas:

- follow-up continuity
- loop reentry prevention
- contextual close-turn
- re-engagement after gap
- document/advisory grounding behavior
- operational thread switching

Constraint:

- proposals marked tenant-specific should not become core regressions unless the tested logic is clearly capability-generic rather than tenant-content-specific

### Phase 5: Targeted Runtime Updates

Goal:

- implement only the logic supported by the distilled analysis

Likely early targets:

- stronger contextual close-turn
- improved distinction between supported fact, bounded inference, and unspecified detail
- better reuse of prior approved facts in follow-up turns
- improved loop prevention based on state progress instead of wording repetition alone

Constraint:

- no one-off fixes for individual conversations
- no vocabulary growth as the primary mechanism

## Initial Prioritization

Recommended order:

1. Corpus distillation and final classification
2. Close-turn contextual behavior
3. Grounding fidelity and fact/inference/unspecified handling
4. Loop prevention and state-progress awareness
5. Additional tenant-capability-specific improvements only after the core conversational behavior is stronger

## Success Criteria For The Planning/Distillation Stage

This planning stage is successful when:

- the latest agreements are documented in one place
- the core versus tenant split is explicit
- document processing is explicitly recognized as core capability
- uploaded documents are explicitly recognized as tenant resources
- the real corpus is explicitly bounded to analysis/regression use
- the next implementation can start from a concrete phased plan without reopening already-closed work
- the plan explicitly forbids new inline vocabulary/regex debt in decisive logic

## Prompt Use

The next implementation prompt should start from this document and must preserve these constraints:

- keep already-completed platform work intact unless a compatibility-safe update is required
- do not add new lexical/regex debt in decisive paths
- use the corpus to extract patterns, not tenant truth
- preserve the distinction between:
  - core platform
  - tenant capability modules
  - tenant resources
