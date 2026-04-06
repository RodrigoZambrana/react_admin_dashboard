# Loss-Minimizing Knowledge Layer Design

## Current Status

This design is now partially implemented in runtime:

- proposition persistence exists
- extraction can emit normalized propositions
- retrieval and knowledge view consume proposition evidence
- response grounding distinguishes:
  - `typed_claim`
  - `normalized_proposition`
  - `excerpt_only`
- response guardrails distinguish:
  - `document_gap`
  - `extraction_uncertain`
- promotion candidates are inspectable through backend aggregation by `patternKey`

What is still intentionally incomplete:

- proposition extraction is still mostly derived from typed claim output, not yet a full independent relation miner
- candidate promotion remains an admin/analysis workflow, not an automatic promotion engine
- no frontend curation UI exists yet for proposition candidates

## Goal

Add a reusable intermediate layer between:

- raw document text and chunks
- typed structured claims

So the platform does not behave as if knowledge were binary:

- either fully typed as a claim
- or only available as loose text

The target model is:

1. raw corpus never lost
2. normalized propositions persisted even when no final axis exists yet
3. typed claims kept as the higher-confidence structured surface
4. response/runtime choosing the strongest available evidence tier

This design is intentionally global:

- no per-document custom rules
- no tenant truth promoted into core
- no new inline lexical heuristics in runtime policy services
- profile and locale resources remain the only place for bounded linguistic cues

## Why This Layer Is Needed

Today the system can lose information structurally when the document expresses a relation the current claim model does not yet know how to represent well.

Examples:

- outside versus inside a location boundary
- component composition versus material identity
- conditional support or compatibility
- negative constraints such as "does not support DVH"

The source text still exists in chunks, but the runtime loses:

- stable follow-up handling
- scoped answers
- safe partial grounding
- explainable distinction between:
  - true document gap
  - extraction/modeling limitation

The proposition layer is the loss-minimizing bridge.

## Architectural Rule

Unknown or not-yet-modeled relations must not be discarded.

They must be persisted as normalized propositions, then:

- used by retrieval and response with lower confidence than typed claims
- observed over time
- promoted only when a repeated structural class justifies a new reusable axis/facet model

## Proposed Persistence Model

The current `DocumentKnowledgeItem` model should remain dedicated to stable typed outputs:

- `ENTITY`
- `CLAIM`

The intermediate layer should not be forced into that same enum because it has a different lifecycle, confidence model, and promotion state.

### New Prisma Enums

```prisma
enum DocumentKnowledgeEvidenceTier {
  TYPED_CLAIM
  NORMALIZED_PROPOSITION
  EXCERPT_ONLY
}

enum DocumentKnowledgePolarity {
  AFFIRMED
  NEGATED
  CONDITIONAL
  COMPARATIVE
  UNKNOWN
}

enum DocumentKnowledgePromotionState {
  UNCLASSIFIED
  CANDIDATE
  PROMOTED
  REJECTED
}
```

### New Prisma Model

```prisma
model DocumentKnowledgeProposition {
  id                String                         @id @default(cuid())
  tenantId          String
  documentId        String
  chunkId           String
  sequence          Int
  layer             String?
  extractionScope   String?
  profileKey        String?
  subjectAxis       String?
  subjectValue      String?
  subjectNormalized String?
  predicate         String
  facet             String?
  objectValue       String
  objectNormalized  String?
  polarity          DocumentKnowledgePolarity
  supportClass      DocumentKnowledgeSupportClass
  evidenceTier      DocumentKnowledgeEvidenceTier @default(NORMALIZED_PROPOSITION)
  confidence        Float
  relationScope     Json?
  canonicalKey      String
  patternKey        String
  evidenceTextSpan  String
  metadata          Json?
  promotionState    DocumentKnowledgePromotionState @default(UNCLASSIFIED)
  promotedAxis      String?
  promotedFacet     String?
  createdAt         DateTime                      @default(now())
  updatedAt         DateTime                      @updatedAt

  document          DocumentRecord               @relation(fields: [documentId], references: [id], onDelete: Cascade)
  chunk             DocumentChunk                @relation(fields: [chunkId], references: [id], onDelete: Cascade)

  @@index([tenantId, documentId, chunkId, sequence])
  @@index([tenantId, predicate, facet])
  @@index([tenantId, patternKey])
  @@index([tenantId, promotionState, updatedAt])
}
```

### Optional Promotion-Aggregate Model

This model is recommended when proposition promotion becomes operationally important.

```prisma
model DocumentKnowledgePropositionPattern {
  id               String                         @id @default(cuid())
  tenantId         String?
  profileKey       String?
  locale           String?
  patternKey       String
  predicate        String
  facet            String?
  polarity         DocumentKnowledgePolarity
  occurrenceCount  Int                            @default(0)
  documentCount    Int                            @default(0)
  promotionState   DocumentKnowledgePromotionState @default(UNCLASSIFIED)
  proposedAxis     String?
  proposedFacet    String?
  sampleMetadata   Json?
  firstSeenAt      DateTime                       @default(now())
  lastSeenAt       DateTime                       @updatedAt

  @@unique([tenantId, profileKey, locale, patternKey])
  @@index([promotionState, occurrenceCount, lastSeenAt])
}
```

If the aggregate model is deferred, the same analysis can still run from `DocumentKnowledgeProposition` directly.

## Proposed TypeScript Contracts

Add repo-level types in `backend/src/modules/documents/document.types.ts`:

```ts
export type DocumentKnowledgeEvidenceTier =
  | 'typed_claim'
  | 'normalized_proposition'
  | 'excerpt_only';

export type DocumentKnowledgePolarity =
  | 'affirmed'
  | 'negated'
  | 'conditional'
  | 'comparative'
  | 'unknown';

export type DocumentKnowledgePromotionState =
  | 'unclassified'
  | 'candidate'
  | 'promoted'
  | 'rejected';

export type DocumentKnowledgePropositionScope = {
  axis: string;
  value: string;
  normalizedValue?: string;
  relation?: string;
};

export type DocumentKnowledgePropositionPayload = {
  predicate: string;
  facet?: string;
  objectValue: string;
  objectNormalizedValue?: string;
  polarity: DocumentKnowledgePolarity;
  relationScope?: DocumentKnowledgePropositionScope[];
  confidence: number;
};

export type DocumentKnowledgePropositionCandidate = {
  sequence: number;
  label: string;
  normalizedValue?: string;
  supportClass: DocumentKnowledgeSupportClass;
  evidenceTextSpan: string;
  metadata?: DocumentKnowledgeItemMetadata;
  proposition: DocumentKnowledgePropositionPayload;
};
```

The important point is that propositions are not free-form summaries. They are normalized relation candidates with provenance and confidence.

## Extraction Changes

### Current State

Extraction produces:

- entities
- typed claims
- support summaries

### Target State

Extraction must produce:

1. typed claims when the current profile model can represent the relation cleanly
2. normalized propositions when the relation is structurally recognizable but not yet safely typable
3. excerpts always, as the lowest evidence tier

### Rule

Do not create document-specific proposition rules.

Instead:

- the base extractor keeps generic structure detection
- the profile owns domain predicates it already understands
- when a sentence/block yields a relation that cannot be typed safely, persist it as a proposition instead of dropping it

### What Gets Persisted As Propositions

Examples of reusable proposition classes:

- support or non-support
- component composition
- inside versus outside scope relations
- conditional costs
- comparative recommendations
- explicit negative statements

Examples:

- subject: `serie 25`
- predicate: `feature_support`
- object: `DVH`
- polarity: `negated`

- subject: `lamas de aluminio`
- predicate: `internal_fill`
- object: `espuma de poliuretano`
- polarity: `affirmed`

- subject: `visita`
- predicate: `cost_condition`
- object: `costo de traslado`
- scope: `location=Montevideo`, `relation=outside`
- polarity: `conditional`

## Retrieval Changes

### Current Behavior

Retrieval is strongest when typed claims already exist. If they do not, the runtime can fall back too quickly to lexical excerpts or behave as if the document did not specify the answer.

### Target Retrieval Order

For each requested detail or question subject:

1. typed claims
2. normalized propositions
3. excerpt-only evidence

This should be explicit in `DocumentRetrievalMatch.supportSummary` and in the response context.

### Proposed Retrieval Additions

Extend the retrieval result so each match can surface:

- `axisSummaries`
- `metadataNotes`
- `propositionSummaries`
- `evidenceTier`

Example:

```ts
supportSummary?: {
  topic?: string;
  supportedAxes: string[];
  unspecifiedAxes: string[];
  axisSummaries?: DocumentKnowledgeAxisSummary[];
  metadataNotes?: DocumentKnowledgeMetadataSummary[];
  propositionSummaries?: DocumentKnowledgePropositionSummary[];
  evidenceTier?: DocumentKnowledgeEvidenceTier;
}
```

### Scoring Direction

Retrieval scoring should:

- prefer exact typed subject matches
- then proposition subject/predicate matches
- then lexical excerpt support

For mixed questions, subject locking should remain stronger than generic semantic similarity.

## Response Policy Changes

### New Grounding Resolution Model

`ResponseGroundingService` should no longer reduce everything to:

- `explicit`
- `partial`
- `unavailable`

It should additionally carry why a requested detail is not fully supported.

### Proposed Response-Grounding Fields

```ts
grounding: {
  supportLevel: 'explicit' | 'partial' | 'unavailable';
  evidenceTier: 'typed_claim' | 'normalized_proposition' | 'excerpt_only' | 'none';
  absenceReason: 'document_gap' | 'extraction_uncertain' | 'not_applicable' | null;
  requestedDetailTypes: ResponseGroundingDetailType[];
  supportedDetailTypes: ResponseGroundingDetailType[];
  partialDetailTypes: ResponseGroundingDetailType[];
  unsupportedDetailTypes: ResponseGroundingDetailType[];
}
```

### Critical Rule For "No Especificado"

The system must not say the document does not specify a detail only because typed claims are absent.

`No especificado` or equivalent wording should only be allowed when:

1. typed claims do not support the detail
2. normalized propositions do not support the detail
3. excerpt retrieval does not show grounded support
4. extraction confidence for the relevant region is high enough that absence is meaningful

If the system has:

- proposition evidence
- or excerpt-only evidence
- or low extraction confidence for the relevant area

Then the response must use extraction-uncertainty wording, not document-gap wording.

Preferred distinction:

- `document_gap`
  - "Por ahora el documento no lo especifica con claridad."
- `extraction_uncertain`
  - "Por ahora no tengo una confirmacion suficientemente clara en la documentacion activa."

This avoids converting extraction limitations into false claims about the source.

### Response Policy Consumption

`ChatResponsePolicyService` should consume:

- typed claim summaries first
- proposition summaries second
- excerpts only as last grounded fallback

And it should vary phrasing by evidence tier:

- typed claim:
  - direct answer
- normalized proposition:
  - cautious but still informative
- excerpt only:
  - paraphrase carefully, avoid categorical phrasing
- none:
  - use absence reason to choose between document gap and extraction uncertainty

## Guardrail Changes

Guardrails should stop treating every unsupported detail as identical.

They should distinguish:

- unsupported because the document does not specify it
- unsupported because the extractor did not produce strong enough structured evidence yet

That means `wrong_unspecified_detail_axis` and similar codes should evolve toward checking:

- whether the response overclaims unsupported detail
- whether the response incorrectly states document absence instead of extraction uncertainty

Recommended new guardrail code:

- `unsupported_document_absence_claim`

Use it when the model says the document does not specify something but proposition or excerpt evidence suggests the source may still contain relevant support.

## Promotion Strategy

Promotion must remain structural, not tenant-truth-driven.

### Rule

Promote repeated proposition classes, not repeated tenant values.

Good promotion candidates:

- predicate classes that recur across documents or tenants
- scope relations that recur across profiles
- negative support patterns that existing claims cannot express safely

Bad promotion candidates:

- one tenant's preferred vocabulary
- specific brands, colors, or business values
- ad hoc phrases from one corpus

### Promotion Workflow

1. Persist normalized propositions for all not-yet-typed relations
2. Aggregate by structural `patternKey`
3. Review recurring patterns by:
   - profile
   - locale
   - polarity
   - scope shape
4. If a pattern class repeats enough, add or refine:
   - axis
   - facet
   - scope relation model
5. Re-ingest affected documents
6. Keep propositions for residual and future unknown relations

### Pattern-Key Principle

`patternKey` must be value-redacted where needed so it captures shape, not tenant truth.

Example:

- `feature_support|negated|subject:series|object:glazing`
- not:
  - `serie_25_no_dvh`

## Repo Touchpoints

### Prisma

- `backend/prisma/schema.prisma`
- new migration for proposition persistence

### Documents

- `backend/src/modules/documents/document.types.ts`
- `backend/src/modules/documents/document-knowledge-extraction.orchestrator.ts`
- `backend/src/modules/documents/document-knowledge-claims.ts`
- `backend/src/modules/documents/document-retrieval.service.ts`
- `backend/src/modules/documents/document-knowledge-view.service.ts`

### Persistence

- `backend/src/modules/persistence/repositories/document-chunk.repository.ts`
- new repository for propositions, or extend the chunk repository boundary carefully without flattening proposition ownership into chunk persistence

### Response

- `backend/src/modules/response/response.types.ts`
- `backend/src/modules/response/response-grounding.service.ts`
- `backend/src/modules/response/response-guardrail.service.ts`
- `backend/src/modules/response/chat-response-policy.service.ts`

## Recommended Rollout Sequence

### Phase 1

- add proposition persistence types and repositories
- persist propositions during extraction without changing user-facing behavior yet

### Phase 2

- expose proposition summaries in retrieval and admin knowledge view
- keep typed claims as the primary evidence tier

### Phase 3

- update response grounding and policy to distinguish:
  - typed support
  - proposition support
  - excerpt-only support
  - document gap
  - extraction uncertainty

### Phase 4

- add promotion analytics by proposition pattern
- promote only the recurrent structural classes

## Non-Goals

- no per-document extraction rules
- no tenant-specific heuristics in core runtime
- no automatic promotion directly into runtime truth without review
- no replacement of typed claims with free-form proposition logic
- no reopening of the locked core versus tenant boundary

## Decision Summary

The repo should evolve from:

- raw text
- chunks
- typed claims

to:

- raw text
- chunks
- normalized propositions
- typed claims

with runtime precedence:

- typed claims first
- propositions second
- excerpts third
- absence wording only when the system can justify true document absence rather than extraction uncertainty
