# Monorepo QA Status

Generated: 2026-05-10T16:09:26.797Z

## Release signal
- verdict :: passed
- test:integrity :: passed :: updated 2026-05-10T16:07:09.162Z
- test:smoke :: passed :: updated 2026-05-10T16:07:18.828Z
- run-qa core :: passed :: updated 2026-05-10T16:09:26.795Z
- run-qa deferred :: not-selected :: passed 0/0

## Monorepo suites
- integrity :: passed :: run monorepo-2026-05-10T16-07-08-268Z :: updated 2026-05-10T16:07:09.162Z
- integrity :: backend :: test:integrity :: passed :: 0
- integrity :: frontend :: test:integrity :: passed :: 0
- integrity :: ecommerce :: test:integrity :: passed :: 0
- integrity :: services/channel-adapter :: test:integrity :: passed :: 0
- integrity :: gaps :: none
- smoke :: passed :: run monorepo-2026-05-10T16-07-09-407Z :: updated 2026-05-10T16:07:18.828Z
- smoke :: backend :: test:smoke :: passed :: 0
- smoke :: frontend :: test:smoke :: passed :: 0
- smoke :: ecommerce :: test:smoke :: passed :: 0
- smoke :: gaps :: none
- coverage :: not-run

## QA release gate
- run-qa :: passed :: release-gate passed :: selected 11 blocks
- run-qa :: profiles :: core 11 :: deferred 7
- core :: storefront-e2e-critical :: passed :: npm run test:e2e:critical :: 4053ms
- core :: storefront-e2e-auth-content :: passed :: npm run test:e2e -- --workers=1 auth-email.spec.ts wishlist-post-login.spec.ts home-stories.spec.ts admin-signin-smoke.spec.ts :: 37372ms
- core :: storefront-e2e-admin-cross-project :: passed :: npm run test:e2e -- --workers=1 admin-signin-smoke.spec.ts admin-mail-inbox-real-account.spec.ts admin-order-detail-cross-project.spec.ts admin-commercial-surfaces.spec.ts :: 36367ms
- core :: storefront-e2e-account-notifications :: passed :: npm run test:e2e -- account-notifications-order-detail.spec.ts :: 9529ms
- core :: storefront-e2e-account-checkout :: passed :: npm run test:e2e -- logged-in-checkout-address-currency.spec.ts :: 8212ms
- core :: backend-domain-core :: passed :: npm test -- src/storefront/__tests__/storefront.service.spec.ts src/storefront/payments/__tests__/mercadopago.service.spec.ts src/orders/__tests__/order-payment-settlement.service.spec.ts src/accounting/__tests__/payments.service.spec.ts src/email/__tests__/email.service.spec.ts :: 1029ms
- core :: backend-domain-extended :: passed :: npm test -- src/orders/__tests__/order-finance.service.spec.ts src/orders/__tests__/order-stock-integrity.service.spec.ts src/conversations/__tests__/conversations.service.spec.ts src/knowledge/__tests__/knowledge.service.spec.ts src/storefront/oauth/__tests__/google-oauth.service.spec.ts src/sales/utils/pricing.spec.ts src/common/privacy/__tests__/masking.spec.ts src/common/orders/__tests__/address.spec.ts :: 1142ms
- core :: frontend-admin-unit :: passed :: npm test -- src/views/sales/components/__tests__/EditableOrderProductsTable.test.tsx src/views/sales/ProductForm/__tests__/PricingFields.test.tsx :: 1043ms
- core :: frontend-admin-extended :: passed :: npm test -- src/utils/__tests__/textDirection.test.ts src/utils/__tests__/salesUnitCalculation.test.ts src/views/crm/CustomerDetail/components/__tests__/OrdersHistory.test.ts src/views/crm/Mail/utils/__tests__/category.test.ts :: 826ms
- core :: channel-adapter-core :: passed :: npm test :: 1857ms
- core :: quality-static :: passed :: npm run lint :: 26356ms

## Deferred QA coverage
- deferred :: storefront-e2e-ai-conversations :: not-run
- deferred :: ai-conversation-quality :: not-run
- deferred :: real-whatsapp-corpus-sync :: not-run
- deferred :: real-webchat-corpus-replay :: not-run
- deferred :: live-webchat-probe-loop :: not-run
- deferred :: real-chat-remediation-loop :: not-run
- deferred :: ai-runtime-smoke :: not-run

## Deferred workspace inventory
- ai-platform :: deferred :: scripts build, dev:backend, dev:frontend, test
- ai-platform/backend :: deferred :: scripts build, prisma:generate, prisma:migrate:deploy, prisma:migrate:dev, prisma:validate, start, start:dev, test
- ai-platform/frontend :: deferred :: scripts build, dev