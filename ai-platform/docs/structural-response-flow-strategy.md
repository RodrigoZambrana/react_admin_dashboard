# Structural Response Flow Strategy

## Objective

Generalize the recent fixes for `purchase_channel` and `confirmation_policy` into a reusable strategy for other current flow cases, without adding one-off patches per conversation.

The target behavior is:

1. preserve factual truth from the document,
2. preserve reusable workflow/guidance semantics,
3. transform operator-facing guidance into customer-facing responses only when the current flow warrants it,
4. prefer structured renderers over raw structural summaries,
5. fall back by evidence tier, not by brittle lexical heuristics.

## Current Structural Pieces

The system already has the right core layers:

1. `typed claims`
   - axes such as `payment_terms`, `color_options`, `warranty_terms`, `service_offers`, `feature_support`, `commercial_visit_cost`, `travel_cost_responsibility`, `commercial_presence`
2. `normalized propositions`
   - loss-minimizing intermediate layer for reusable relations not yet fully promoted
3. `guidance/workflow/prudence claims`
   - axes such as `informative_flow`, `quote_transition`, `confirmation_policy`, `organic_response_pattern`, `comparison_guidance`
4. `response grounding catalog`
   - detail types, supported axes, unspecified cues, exactness cues
5. `response policy`
   - summary selection, customer-facing renderers, fallback selection

The missing piece is not a new axis every time. The missing piece is a single structural pattern for how these layers cooperate.

## Core Principle

Every new conversational case should be resolved through the same chain:

1. `detail type`
   - what the user is asking for
2. `evidence family`
   - factual, proposition, guidance, excerpt
3. `flow stage`
   - informative, comparison, quote transition, execution, close
4. `response mode`
   - direct answer, cautious answer, answer plus orientation, clarifying next step, close

No case should skip directly from “manual test failed” to “new inline heuristic”.

## Reusable Building Blocks

### 1. Detail-to-axis mapping

`response-grounding` should keep being the single place where a `detailType` maps to:

- `supportedAxes`
- `unspecifiedAxes`
- `generalEvidenceTerms`
- `requestTerms`

This mapping must stay in locale resources, not in service code.

Current examples:

- `payment_terms -> payment_methods, payment_terms, installment_count`
- `purchase_channel -> commercial_presence, service_offers, coverage_locations`
- `warranty -> warranty_terms`
- `feature_support -> feature_support`

Future cases should extend this resource layer, not reintroduce hardcoded axis dispatch in services.

### 2. Guidance transformers

Guidance axes are not meant to be surfaced verbatim. They need structural transformers.

Reusable transformer families:

- `confirmation_policy`
  - convert “if exact detail is not confirmed...” into:
    - customer-facing uncertainty
    - optional orientation prompt
    - optional commitment to confirm later
- `informative_flow`
  - stop the system from jumping to quoting too early
- `quote_transition`
  - only ask the next required budget fields when the user actually moved into quote intent
- `organic_response_pattern`
  - phrasing enhancer, not factual source of truth
- `comparison_guidance`
  - turn reusable recommendation notes into a recommendation answer when the user is comparing

These transformers should remain generic and flow-aware. They should not encode tenant values in code.

### 3. Customer-facing renderers

For important detail clusters, policy should prefer a natural renderer instead of exposing:

- structural summaries,
- raw support labels,
- or guidance prose copied from the document.

Renderer families already present or implied:

- `payment_terms`
- `color_options`
- `warranty`
- `purchase_channel`
- `visit cost / location coverage`

Renderer families that should be formalized next:

- `feature_support`
  - especially for `DVH`, glazing, monoblock, mosquito screen, integrated shutter
- `service_capability`
  - for “hacen ese tipo de trabajo?”, “toman medidas?”, “instalan?”, “reparan?”
- `quote_fields`
  - customer-facing “para presupuestar necesitamos...”
- `comparison_guidance`
  - concise recommendation output instead of raw comparison notes

## Proposed Structural Matrix

Each detail type should resolve through this matrix:

### A. Factual answer available

Use:

- typed claim renderer first
- proposition-backed renderer second
- excerpt paraphrase third

Do not append `confirmation_policy` unless the user also requested exactness beyond what is supported.

### B. Factual answer partially available

Use:

- the supported part in customer-facing prose
- then a cautious clause for the unsupported exact detail

If `confirmation_policy` exists and the unsupported part is exactness-sensitive, transform it into:

- “I do not have exact confirmation on X”
- “if you tell me product/line/variant, I can orient you and confirm that exact detail if needed”

### C. No factual support, but reusable guidance exists

Do not surface the guidance literally.

Transform guidance into one of:

- orientation answer
- clarifying next-step prompt
- cautious redirection

The transformer chosen depends on flow stage.

### D. No structured support at all

Use:

- grounded excerpt if it is directly usable
- otherwise cautious fallback

But the fallback must distinguish:

- `document_gap`
- `extraction_uncertain`

## Flow-Aware Activation Rules

This is the key to avoiding degraded answers.

### `confirmation_policy`

Should activate only when:

- the user is asking for an exact or availability-sensitive detail,
- factual support is missing or partial,
- and the response would otherwise degrade to raw guidance or a weak unspecified clause.

Should not activate when:

- factual support already answers the question,
- or the unsupported detail is not relevant to the current turn.

### `quote_transition`

Should activate only when:

- the user has clearly moved into quote/estimate intent,
- and the turn is asking “what do you need?”, “how do we move forward?”, or equivalent.

Should not activate for purely informative browsing.

### `informative_flow`

Should affect planning, not literal output.

It should bias the system toward:

- answer first,
- orient second,
- quote later.

### `organic_response_pattern`

Should never be the primary evidence source.

It should only:

- improve tone,
- improve ordering,
- improve phrasing,

after the factual/guidance decision is already made.

## Next Structural Cases To Include

These current flows should be brought under the same model next.

### 1. `service_capability`

Examples:

- `hacen ese tipo de trabajo?`
- `toman medidas?`
- `instalan?`
- `reparan?`

Structural approach:

- add or reuse `supportedAxes` from:
  - `service_offers`
  - `coverage_locations`
  - `commercial_visit_cost`
- add a natural renderer for capability answers
- optionally add a follow-up orientation branch when the document includes next-step guidance

### 2. `quote_requirements`

Examples:

- `qué datos necesitan para cotizar?`
- `cómo presupuestan ese cambio?`

Structural approach:

- keep `quote_fields` as structured workflow axis
- add a customer-facing renderer that:
  - lists required inputs,
  - keeps ordering stable,
  - scopes by product family when possible

### 3. `comparison_answer`

Examples:

- `qué me recomiendan para dormitorio?`
- `qué conviene, PVC o aluminio?`
- `qué línea conviene para DVH?`

Structural approach:

- use `comparison_guidance` only as structured recommendation support
- add a renderer that:
  - states the recommendation,
  - gives the short why,
  - optionally names an alternative

### 4. `feature_support`

Examples:

- `soporta DVH?`
- `tiene mosquitero?`
- `admite monoblock?`

Structural approach:

- typed claims or propositions for `feature_support`
- render polarity explicitly:
  - supports
  - does not support
  - related/recommended for

## Recommended Runtime Precedence

For every document-grounded turn:

1. determine `detailType`
2. resolve `supportedAxes` from resources
3. gather evidence in this order:
   - typed claims
   - promoted propositions
   - normalized propositions
   - excerpts
4. select `response mode`
   - direct answer
   - answer plus orientation
   - cautious answer
   - clarifying next step
   - close
5. apply a renderer or guidance transformer
6. apply phrasing enhancement only at the end

## Implementation Pattern For Future Cases

Every future conversational gap should be implemented in four steps.

### Step 1. Evidence

Decide whether the missing concept is:

- a reusable factual axis,
- a proposition-only relation for now,
- or just a new `detailType -> supportedAxes` mapping.

### Step 2. Grounding

Declare it in locale resources:

- request terms
- evidence terms
- supported axes
- unspecified axes

### Step 3. Response mode

Decide whether the case needs:

- a natural renderer,
- a guidance transformer,
- or both.

### Step 4. Tests

Add tests at three levels:

- extraction
- grounding
- response policy

And then, when useful, add a multi-turn chat test center scenario.

## Guardrail For “only when the flow warrants it”

The system should not always prefer transformed guidance.

It should prefer transformed guidance only when:

- the current turn asks for a detail that is not fully supported,
- the guidance axis is relevant to that exact gap,
- and the transformed answer is better than:
  - raw grounded summary,
  - raw structural summary,
  - generic unspecified fallback.

This rule prevents the system from overusing `confirmation_policy` or `quote_transition` when a direct factual answer already exists.

## Summary

The reusable pattern is:

1. `detailType -> supportedAxes` from resources
2. typed claims and propositions as evidence ladder
3. guidance axes as structured transformers, never verbatim primary output
4. natural renderers per detail cluster
5. flow-aware activation so the system only applies transformed guidance when the current turn really needs it

This is the strategy that allows new current-flow cases to be added globally, without devolving into isolated patches.
