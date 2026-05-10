# Runtime Integrity Report

Generated: 2026-05-09T19:54:39.550Z

## Summary
- Manifest/spec drift issues: 0
- Critical script issues: 0
- Critical skip issues: 0
- Workbook governance issues: 0
- Deferred targets inventoried: 9

## Findings
- none

## Issue Counts

## Deferred Scope
- Deferred matching now stays limited to explicit AI/chat-platform evidence instead of broad conversation or email naming patterns.
- Deferred inventory remains informative only; it cannot keep workbook rows green on its own.

## Critical Scripts
- Mercado Pago remains a critical payment path and must be validated against live secure config, not a mocked success path.
- `ecommerce/test:e2e:critical` still hard-fails if declared specs drift or disappear.