# AI Error Flow Capture Schema

## Goal

Convert unexpected or low-quality conversational outcomes into structured inputs for:

- code fixes
- deterministic rule improvements
- prompt/runtime response improvements
- regression tests

The objective is to capture the failure before it becomes anecdotal knowledge.

## Scope

Apply this schema to:

- customer-facing chat
- admin/internal assistant
- email-assisted flows
- multimodal conversations with attachments

## When To Register A Case

Create an error-flow record when at least one of these conditions is true:

- the user-visible response is incorrect, vague, off-topic, or too broad
- the system called the provider when a deterministic/knowledge-first answer was expected
- the system failed to use already approved knowledge
- the system invoked the wrong intent or tool
- a fallback leaked to the user when a contextual clarification was expected
- a security/authorization rule should have blocked earlier
- an attachment was ingested but not interpreted, rendered, or used correctly
- storefront/admin parity broke for preview, author, handoff, or control mode

## Canonical Record

```json
{
  "id": "err_2026_03_27_001",
  "createdAt": "2026-03-27T21:10:00.000Z",
  "tenantKey": "urucortinas",
  "surface": "storefront_webchat",
  "scope": "customer_public",
  "channel": "webchat",
  "conversationId": "cmxxxx",
  "messageId": "cmmsgxxx",
  "input": {
    "rawText": "Buenos dias como estas? Mi nombre es rodrigo y necsto informnacion",
    "normalizedText": "buenos dias como estas mi nombre es rodrigo y necesito informacion",
    "attachments": []
  },
  "expected": {
    "behavior": "clarify_minimum",
    "responseText": "Buenos días, Rodrigo. Claro, ¿sobre qué te gustaría información?"
  },
  "actual": {
    "behavior": "low_confidence_fallback",
    "responseText": "En este momento no pude completar la respuesta automática..."
  },
  "runtime": {
    "classification": "generic_help_request",
    "intentKey": "unknown",
    "shouldCallAI": false,
    "providerCalled": false,
    "fallbackReason": "low_confidence"
  },
  "diagnosis": {
    "bucket": "missing_deterministic_rule",
    "probableCause": "No explicit generic help intent was applied before fallback.",
    "fixType": "intent_engine"
  },
  "status": "open"
}
```

## Required Fields

- `surface`: `storefront_webchat | admin_chat | email_inbox | whatsapp | api`
- `scope`: `customer_public | customer_authenticated | admin_internal`
- `channel`
- `input.rawText`
- `expected.behavior`
- `actual.behavior`
- `runtime.intentKey`
- `runtime.providerCalled`
- `diagnosis.bucket`

## Classification Buckets

- `normalization_gap`
  Example: typo, abbreviation, glued words, ASR noise.
- `missing_deterministic_rule`
  Example: generic help, incomplete message, courtesy, contact info.
- `faq_selection_gap`
  Example: system answered with a whole catalog instead of the asked topic.
- `knowledge_gap`
  Example: approved knowledge exists but retrieval/shaping did not use it.
- `provider_overuse`
  Example: provider called for a simple FAQ or clarification.
- `fallback_quality_gap`
  Example: technical fallback shown instead of guided clarification.
- `security_guard_gap`
  Example: unauthorized request advanced too far before being blocked.
- `channel_parity_gap`
  Example: storefront/admin show different preview, author, handoff.
- `multimodal_gap`
  Example: attachment ingested but not rendered or not used in context.
- `execution_guard_gap`
  Example: confirmation, verify, or authorization missing before action.

## Fix Types

- `normalizer`
- `inbound_classifier`
- `intent_engine`
- `knowledge_selection`
- `response_shaping`
- `fallback_renderer`
- `security_policy`
- `channel_contract`
- `attachment_policy`
- `tool_registry`
- `regression_test_only`

## Triage Rules

### P0

- leaked sensitive/internal data
- unauthorized action path
- customer accessed someone else’s protected data
- destructive or money-impacting action bypassed confirmation

### P1

- wrong answer with business impact
- provider called unnecessarily in a frequent path
- approved knowledge ignored
- handoff/control mode inconsistency

### P2

- tone/clarity issue
- over-broad answer
- duplicate or repetitive response
- attachment preview/render inconsistency

## Minimum Evidence To Store

- raw user input
- final visible answer
- intent/classification chosen
- whether AI/provider was called
- fallback reason if any
- retrieval snippets used, if any
- attachment/message elements summary, if any

## Conversion To Backlog

Each captured case should end in one of these outcomes:

- `fix_now`
- `documented_expected_behavior`
- `add_regression_test`
- `defer_with_known_workaround`

If the issue is accepted as valid behavior, document the criterion explicitly and link the record.

## Recommended Admin Surface

Future admin table or queue:

- case id
- created at
- surface
- classification bucket
- expected vs actual
- probable cause
- proposed fix
- status

## Quick Wins

1. Persist `error-flow` review records in a lightweight table or JSON log.
2. Add a “Report response issue” action in admin conversation detail.
3. Auto-open a record whenever:
   - `fallbackReason` exists
   - `providerCalled=true` on a low-complexity FAQ
   - `needsHuman=true` on a case classified as deterministic
4. Require each accepted bugfix to add at least one regression case reference.
