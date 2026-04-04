# Core, Tenant Capability, And Tenant Resource Boundaries

## Purpose

This document locks the architecture boundary model that must govern the current `/ai-platform` branch before any additional corpus-distillation or Wave 9 hardening work starts.

It exists to keep the platform aligned around three distinct layers:

- core platform
- tenant capability modules
- tenant resources

The distinction is mandatory because real-corpus frequency from one tenant does not redefine what belongs in the reusable platform.

## Boundary Model

### Core Platform

Core platform behavior is the reusable conversational substrate that every tenant can inherit.

Core includes:

- conversational substrate
- continuity
- grounding
- source selection
- contextual closure
- advisory continuity
- document continuity
- observability
- async intake
- document-processing capability

Document-processing capability is core because the platform must be able to:

- ingest approved tenant documents
- chunk/index them
- retrieve relevant excerpts
- synthesize grounded answers over approved document context

Important clarification:

- document processing is core
- document content is not core
- uploaded document content remains tenant-scoped approved knowledge

### Tenant Capability Modules

Tenant capability modules are optional business workflows layered on top of the core platform.

Current and near-term examples:

- booking / scheduling
- quote / measurements
- product catalog lookup
- support / post-sale

These are not core just because they appear frequently in one corpus.

Corpus-derived labels such as:

- `quote_request`
- `structured_measurements`
- `appointment_scheduling`

must be read as tenant capability behavior patterns, not as proof that those behaviors belong in core runtime logic.

### Tenant Resources

Tenant resources are tenant-scoped sources of approved business truth consumed by either the core platform or tenant capability modules.

Examples:

- uploaded documents
- catalogs
- pricing
- payment terms
- hours
- references
- policies
- other approved tenant-scoped business truth

These resources must remain outside core business logic, but they must remain usable when loaded through approved tenant-governed boundaries.

## Real Corpus Rule

The real corpus is analysis and regression input only.

It must never become:

- active runtime knowledge
- implicit routing truth
- embedded fallback wording
- hardcoded business content

The corpus is valid input for:

- pattern distillation
- regression fixtures
- boundary decisions
- identifying conversational failure modes

## What Must Be Preserved

The following branch behavior is already complete and must remain intact unless a compatibility-safe adjustment is strictly required:

- real OpenAI exploratory runtime readiness
- async public chat foundation
- admin document ABM
- document-origin retrieval
- separation between document-origin knowledge, runtime-learned knowledge, and backend transactional truth
- booking reliability improvements
- document/advisory continuity improvements
- routing-signal ownership cleanup

## Implementation Discipline

The next implementation phases must preserve these rules:

- do not move tenant business truth into core logic
- do not use corpus frequency to justify core behavior
- do not add inline regex or vocabulary debt in decisive services
- do not let runtime-learned knowledge become the primary retrieval corpus for document-grounded answers
- do not blur document knowledge with transactional execution truth

## Quick Classification Table

| Layer | Owns | Examples |
| --- | --- | --- |
| Core platform | reusable conversational runtime behavior | continuity, grounding, source selection, contextual closure, async intake, document processing |
| Tenant capability modules | optional business workflows | booking, quote/measurements, product lookup, support/post-sale |
| Tenant resources | tenant-scoped approved business truth | uploaded documents, catalogs, pricing, payment terms, hours, policies, references |
