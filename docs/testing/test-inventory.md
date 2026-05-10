# Test Inventory

Fecha de relevamiento: `2026-05-08`

Inventario de suites detectadas en el repo, separado por proyecto y por tipo de cobertura.

## Ecommerce

### Runners y configuración

- [ecommerce/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/package.json)
- [ecommerce/playwright.config.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/playwright.config.ts)
- [ecommerce/vitest.config.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/vitest.config.ts)

### Conteo detectado

- `49` specs E2E en `ecommerce/e2e`
- `7` specs unitarias/utilitarias en `ecommerce/src`
- `56` en total

### Cobertura visible

- Home, navegación, listing, PDP
- Carrito, checkout, success
- Auth, account, wishlist
- SEO, analytics, metadata
- Admin cross-project, conversaciones, QA center
- Flujos de chat y webchat
- Casos negativos y regresión crítica

### Observaciones

- El package expone Playwright como suite principal.
- Hay tests Vitest en `src/`, pero no hay script `test`/`test:unit` en el `package.json`.
- Esto deja cobertura útil fuera de la entrada operativa normal.

## Frontend admin

### Runners y configuración

- [frontend/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/frontend/package.json)
- [frontend/vitest.config.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/frontend/vitest.config.ts)

### Conteo detectado

- `7` tests

### Cobertura visible

- Views de sales y CRM
- Utils compartidas
- Config de navegación

### Observaciones

- Buena base de unit/component testing.
- No hay E2E browser propio del package.

## Backend

### Runners y configuración

- [backend/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/package.json)
- [backend/vitest.config.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/vitest.config.ts)

### Conteo detectado

- `54` tests

### Cobertura visible por dominio

- Analytics: `8`
- Auth: `6`
- Inbox: `6`
- Storefront: `6`
- AI: `5`
- Budget: `3`
- Orders: `3`
- Accounting: `2`
- CMS: `2`
- Common: `2`
- Email: `2`
- Sales: `2`
- Aberturas, conversions, customers, knowledge, pricing, qa, users: `1` cada uno

### Observaciones

- Es la suite más distribuida por dominio funcional.
- Vitest está bien definido como runner principal.
- Hay buena densidad de tests de negocio y contratos internos.

## AI platform backend

### Runners y configuración

- [ai-platform/backend/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/backend/package.json)
- [ai-platform/backend/jest.config.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/backend/jest.config.ts)

### Conteo detectado

- `84` tests en `ai-platform/backend/test`
- `7` specs adicionales en `ai-platform/backend/src/modules`
- `91` en total

### Cobertura visible

- Runtime y architecture of chat/AI pipeline
- Prompt assembly and policy
- Response fallback/guardrail/grounding
- Document knowledge extraction and promotion
- Tenant scoping and runtime config
- Admin test center and diagnostics

### Observaciones

- Suite muy amplia y valiosa.
- `jest --runInBand` indica costo alto de ejecución.
- Queda `deferred` para la fase actual.

## AI platform frontend

### Runners y configuración

- [ai-platform/frontend/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/frontend/package.json)

### Conteo detectado

- `0` tests declarados

### Observaciones

- Esta superficie está sin cobertura automatizada visible.
- Si la app sigue vigente, debe entrar en recovery priorizado.
- Queda `deferred` para esta estrategia.

## Channel adapter

### Runners y configuración

- [services/channel-adapter/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/services/channel-adapter/package.json)

### Conteo detectado

- `7` tests

### Cobertura visible

- Meta adapter
- WhatsApp QR adapter
- Webchat adapter
- Normalization
- Runtime coalescer / assembler

### Observaciones

- Los tests existen, pero el package no expone un runner formal.
- Es una deuda de integración con CI y con el flujo de mantenimiento.

## AI y conversacional diferido

Estas superficies existen y quedan inventariadas, pero excluidas del recovery inicial:

- [docs/testing/deferred-ai-testing.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/deferred-ai-testing.md)
- [ecommerce/e2e/storefront-webchat.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/storefront-webchat.spec.ts)
- [ecommerce/e2e/storefront-webchat-authenticated-memory.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/storefront-webchat-authenticated-memory.spec.ts)
- [ecommerce/e2e/admin-conversations-inbox-regression.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-inbox-regression.spec.ts)
- [ecommerce/e2e/admin-conversations.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations.spec.ts)
- [ecommerce/e2e/admin-conversations-message-types.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-message-types.spec.ts)
- [ecommerce/e2e/admin-conversations-subroles.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-subroles.spec.ts)
- [ecommerce/e2e/admin-conversations-email-reply.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-email-reply.spec.ts)
- [ecommerce/e2e/admin-conversations-meta-status.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-meta-status.spec.ts)
- [ecommerce/e2e/admin-conversations-mobile-detail.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-mobile-detail.spec.ts)
- [ecommerce/e2e/admin-aberturas-ai-flows.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-aberturas-ai-flows.spec.ts)
- [ecommerce/e2e/aberturas-chat-persistence-cross-scope.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/aberturas-chat-persistence-cross-scope.spec.ts)
- [backend/src/ai](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/ai)
- [backend/src/knowledge](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/knowledge)
- [backend/src/analytics/ai-insights.service.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/analytics/ai-insights.service.ts)
- [backend/src/qa](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/qa)
- [ai-platform/backend](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/backend)
- [ai-platform/frontend](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/frontend)
- [services/channel-adapter/src](/Users/rodrigo/Git/personal/react_admin_dashboard/services/channel-adapter/src)

## QA operativo y contrato vivo

Estos no son suites automáticas puras, pero forman parte del sistema de calidad:

- [docs/qa/manual-functional-master.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/manual-functional-master.md)
- [docs/qa/system-use-cases-report.xlsx](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/system-use-cases-report.xlsx)
- [tools/qa/run-qa.mjs](/Users/rodrigo/Git/personal/react_admin_dashboard/tools/qa/run-qa.mjs)
- [tools/qa/manifest.json](/Users/rodrigo/Git/personal/react_admin_dashboard/tools/qa/manifest.json)

## Síntesis

Hay cobertura real suficiente para sostener partes importantes del sistema, pero todavía no existe una arquitectura homogénea de ejecución, priorización y reporte para todo el ecosistema.
