# E2E Commerce QA Checklist

## Scope
- Public catalog and product detail
- Cart and checkout
- Shipping and delivery selection
- Mercado Pago payment semantics
- Order creation and confirmation
- Transactional aftermath: timeline, notifications, emails
- Stock integrity on create/cancel

## Closure Criteria
- No critical inconsistencies between storefront, backend, accounting and admin.
- No public flow marks an order as paid before payment is actually confirmed.
- A cancelled order is never reopened in place; reopen/repeat/regenerate must create a new order.
- Shipping snapshot is visible and consistent from checkout to created order.

## Policy Locked
- Cancelled to active: not allowed on the same order.
- Reopen / repeat / regenerate: must create a new order.
- Stock MVP: commit on storefront order creation, release on order cancellation.
- Fulfillment MVP: `home_delivery` only, `UY` only, `shippingOptionId` required.

## Checklist

### 1. Catalog and product detail
- [x] Public categories endpoint responds and storefront nav uses real categories.
- [x] Product detail resolves by clean slug.
- [x] Parametric product config resolves for the openings product family.
- [ ] Stock availability messaging in storefront matches final stock policy for edge cases.

### 2. Cart
- [x] Add/remove/update quantity works locally in storefront.
- [x] Cart totals include product subtotal and tax estimates.
- [ ] Server-side cart persistence remains out of scope for this phase.

### 3. Checkout details
- [x] Contact and shipping address are required before review.
- [x] `shippingOptionId` is required before review/order creation.
- [x] Fulfillment mode locked to `home_delivery`.
- [x] Country restricted to `UY`.

### 4. Delivery snapshot
- [x] Shipping option endpoint is available: `/api/storefront/shipping-options`.
- [x] Delivery fee is included in totals.
- [x] Review shows delivery mode, shipping option and ETA snapshot.
- [x] Created order summary exposes delivery snapshot.

### 5. Payment semantics
- [x] `pending`, `in_process` and `authorized` do not close the order as paid.
- [x] Storefront success/review screens do not treat `authorized` as settled payment.
- [x] Backend attach/webhook/accounting settlement path shares post-payment orchestration base.
- [x] Payment success/error/review flow now uses localized copy consistently in `es` and `en`.
- [x] Confirmed payment flow now sends the user to `My orders / Mis compras` instead of returning to review.
- [x] Mercado Pago preference initialization now retries transient failures and exposes explicit retry in UI.
- [x] Payment Brick now enables `prepaidCard` explicitly and preference creation propagates `maxInstallments`.
- [ ] Integration evidence with real Mercado Pago webhook transitions still pending.

### 6. Post-payment transactional behavior
- [x] Settlement service triggers timeline and notification dispatch plan from the shared backend path.
- [ ] Verify end-to-end buyer email after confirmed payment with provider enabled.
- [ ] Verify admin notification/email after confirmed payment with provider enabled.

### 7. Stock integrity
- [x] Storefront order creation decrements stock atomically with order creation.
- [x] Admin cancellation releases committed stock.
- [x] Cancelled order cannot be reactivated in place.
- [ ] Manual/admin exceptional flows still need exploratory verification in UI.

### 8. Auth and customer account
- [x] Storefront session bootstrap from cookie keeps login across refresh.
- [ ] Full account order-history verification after real paid order remains pending.

### 9. Operational blockers / external dependencies
- [ ] Real Mercado Pago sandbox confirmation path
- [ ] Real transactional email provider delivery evidence
- [ ] Final delivery operations rules beyond MVP (`home_delivery`, `UY`)

## Evidence Collected
- Backend tests cover:
  - Mercado Pago settlement semantics
  - shared order-payment settlement orchestration
  - storefront order creation with attached authorized payment intent
  - stock commit/release behavior
  - cancelled order non-reactivation policy
- Local Docker runtime health:
  - backend `/api/health`
  - storefront `/api/health`
  - backend `GET /api/storefront/shipping-options`
- Mercado Pago preference endpoint validated after the latest changes:
  - `POST /api/storefront/payments/mercadopago/preference` returns a real `preferenceId` in local sandbox mode.

## Out of Scope for This Closure
- Advanced logistics workflows beyond `home_delivery`
- Server-side cart persistence
- Alternative payment providers
- Mobile-first feed/stories evolution
- Dynamic SEO evolution
