# Backend Traceability

Fecha de evaluación: `2026-05-08`

## Fuente de verdad

- Excel maestro: [docs/qa/system-use-cases-report.xlsx](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/system-use-cases-report.xlsx)
- Hoja operativa: `Contrato vivo`
- Hoja de arranque manual: `Guia manual`
- Hoja de errores: `Hallazgos`

## Mapa funcional backend

| Caso Excel | Dominio | Suite / archivo de cobertura | Estado runtime | Criticidad | Gap |
|---|---|---|---|---|---|
| `ECOM-AUTH-014` | auth / validation | `backend/src/storefront/dto/auth.dto.ts`, `backend/src/storefront/__tests__/auth.dto.spec.ts` | cubierto y verde | alta | sin gap conocido |
| `ECOM-AUTH-003` / `ECOM-AUTH-006` | auth / oauth | `backend/src/storefront/oauth/__tests__/google-oauth.service.spec.ts` | cubierto y verde | alta | depende de credenciales en runtime real |
| `ECOM-CART-005` | storefront / parametric fallback | `backend/src/storefront/storefront.service.ts` | cubierto y verde | crítica | revisar el warning de dominio si reaparece |
| `ECOM-PROD-003` | product / parametric matrix | `backend/src/storefront/storefront.service.ts`, `backend/src/pricing/parametric-pricing.service.ts` | cubierto y verde | crítica | sin gap conocido |
| `ECOM-CHK-001` | checkout backend | `backend/src/storefront/storefront.service.ts`, `backend/src/orders/__tests__/*` | cubierto y verde | crítica | sin gap conocido |
| `ECOM-CHK-007` / `009` / `010` | checkout validation | `backend/src/storefront/dto/*`, `backend/src/storefront/__tests__/auth.dto.spec.ts` | cubierto y verde | alta | sin gap conocido |
| `ECOM-PAY-001` / `002` | payments | `backend/src/storefront/payments/__tests__/*`, `backend/src/storefront/dto/mercadopago-charge.dto.ts` | cubierto y verde | crítica | depende de provider habilitado en prod |
| `ECOM-PAY-004` / `005` / `006` / `007` | payments validation | `backend/src/storefront/dto/mercadopago-charge.dto.ts` | cubierto y verde | alta | sin gap conocido |
| `ECOM-ORD-001` / `002` / `003` / `004` | orders / post-purchase | `backend/src/orders/__tests__/*` | cubierto y verde | crítica | sin gap conocido |
| `ECOM-ANL-001` / `002` | analytics | `backend/src/analytics/__tests__/*`, `ecommerce/src/lib/analytics/eventSchema.ts` | cubierto y verde | media | sigue sin CI gate de coverage dedicado |
| `ECOM-SEARCH-001` / `002` | storefront search | `backend/src/storefront/__tests__/storefront.service.spec.ts` | cubierto y verde | media | sin gap conocido |
| `CROSS-003` / `008` / `009` / `012` / `016` / `017` / `018` / `019` | cross-project contracts | `backend/src/*` + `ai-platform/backend/src/modules/*` | cubierto y verde | crítica | AI surfaces quedan fuera de recovery inicial |
| `CROSS-020` / `021` | canonical / analytics handoff | `backend/src/storefront/storefront.service.ts`, `backend/src/analytics/*` | cubierto y verde | crítica | validar repetición manual si vuelve a aparecer el warning |

## Mapa por suite backend

| Suite | Casos Excel asociados | Observación |
|---|---|---|
| `src/auth/**` | `ECOM-AUTH-003`, `ECOM-AUTH-006`, `ECOM-AUTH-014`, `CROSS-017`, `CROSS-018`, `CROSS-009` | base de auth y validación saneada |
| `src/storefront/**` | `ECOM-CART-005`, `ECOM-PROD-003`, `ECOM-CHK-001`, `ECOM-SEARCH-001`, `ECOM-SEARCH-002`, `ECOM-PROD-004`, `ECOM-PROD-005` | core de storefront sano |
| `src/storefront/payments/**` | `ECOM-PAY-001` a `ECOM-PAY-007` | validaciones de pago en verde |
| `src/orders/**` | `ECOM-ORD-001` a `ECOM-ORD-004`, `CROSS-001`, `CROSS-005`, `CROSS-015`, `CROSS-016` | post-compra consistente |
| `src/accounting/**` | `ECOM-PAY-001` / `002`, `CROSS-016` | settlement y reporting en verde |
| `src/email/**` | `CROSS-019`, notificaciones de pedido | runtime sano en mocks y settings |
| `src/inbox/**` | `CROSS-008`, `CROSS-012` | handoff de mensajes consistente |
| `src/cms/**` | `ADMIN-CMS-*`, `ECOM-HOME-001`, `ECOM-HOME-002` | contenido y SEO dependen de CMS |
| `src/analytics/**` | `ECOM-ANL-001`, `ECOM-ANL-002`, `CROSS-021` | cobertura existente, sin gate formal de coverage |
| `src/qa/**` | soporte operativo | útil para trazabilidad, no para negocio directo |
| `src/ai/**`, `src/knowledge/**` | deferred | inventariado pero fuera del recovery inicial |

## Gaps de trazabilidad detectados

1. El workbook cubre el backend funcional, pero no siempre identifica la misma suite que lo implementa.
2. Falta una relación explícita y mantenida entre `Caso Excel` y `script backend` para cada dominio.
3. La capa AI aparece mezclada en el workbook y debe seguir marcada como `deferred`.
4. No existe todavía una columna automática de `runtime status` por suite en el workbook; este documento suple ese gap.

## Regla de uso

- Si cambia auth, pricing, orders, checkout o payments, hay que revisar primero los casos Excel marcados como crítica.
- Si cambia CMS o analytics, hay que revisar el handoff con storefront y el contrato vivo.
- Si reaparece un warning de canónica/paramétrica, revisar `ECOM-CART-005` y `ECOM-CAN-001` antes de cerrar.

