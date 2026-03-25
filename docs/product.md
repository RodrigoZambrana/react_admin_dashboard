# Product Baseline

## Scope

This repository powers a configurable commerce platform with three primary runtimes:

- `backend`: canonical business API and source of truth
- `frontend`: admin/operations UI
- `ecommerce`: storefront UI

The current client baseline is `urucortinas`, but the architecture must remain reusable for additional tenants and eventual SaaS evolution.

## Core Domains

- Catalog and parametric products
- Orders, payments, quotes, notifications and email
- Customer accounts and checkout
- CRM operations and inbox/mail handling
- CMS-controlled storefront sections
- AI-assisted conversations and operator handoff

## Current Product Priorities

1. Stabilize existing commerce, CRM and inbox flows
2. Keep cross-project coherence between storefront, backend and admin
3. Build a reusable conversation hub with:
   - unified inbox
   - operator takeover/release
   - channel awareness
   - AI-ready routing
4. Prepare a generic AI action layer reusable across tenants:
   - appointments
   - customers
   - quotes
   - orders
   - payments
   - products

## Inbox and Conversation Requirements

- Admin must support a unified inbox and channel-specific views
- Operator and AI must be able to switch control immediately
- Customer/public and admin/internal scopes must stay separated
- Message origin channel must always be visible in admin
- Email is part of the same operator-facing inbox surface
- Webchat, WhatsApp, Instagram and Facebook must converge to the same canonical conversation model

## Delivery Principle

Ship incremental slices that improve:

- stability
- coherence
- test coverage
- portability across tenants

Any incident found in a core flow should become a regression test or a documented pending item.
