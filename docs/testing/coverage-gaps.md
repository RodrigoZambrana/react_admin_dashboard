# Coverage Gaps

Fecha de auditoria: `2026-05-08`

## Gaps funcionales prioritarios

| Dominio | Estado workbook | Evidencia actual | Gap real | Prioridad |
| --- | --- | --- | --- | --- |
| `ECOM-SEARCH-001` / `002` | `DEFINIDA` | codigo y componentes, sin rerun valido | busqueda visible y empty state sin proteccion automatizada demostrable | P0 |
| `ECOM-CAN-001` | `DEFINIDA` | codigo y backend, sin cierre E2E valido | canonicidad monoblock puede romper PDP -> carrito -> checkout | P0 |
| `ECOM-ANL-001` / `002` | `DEFINIDA` | specs en UI y backend, sin rerun de flujo | eventos estructurales pueden degradarse sin deteccion end-to-end | P0 |
| `ECOM-MOB-001` | `DEFINIDA` | evidencia indirecta | no existe smoke movil core verificable hoy | P1 |
| `ECOM-PERF-001` | `DEFINIDA` | evidencia indirecta | no hay gate de estabilidad visual o carga critica | P1 |
| `ADMIN-CMS-003` | `DEFINIDA` | metadata + commercial surfaces | falta prueba activa de edicion canonica sin degradar SEO publico | P1 |
| `CROSS-020` / `021` | `DEFINIDA` | mezcla backend + analytics + e2e | handoff canonicas/analytics sin validacion fresca | P0 |
| `ECOM-PAY-001` / `002` | `PENDIENTE` | spec inexistente | flujo feliz de Mercado Pago sin proteccion automatizada real | P0 |

## Casos marcados como cubiertos con evidencia no confiable

Casos unicos aun afectados en `Contrato vivo` por evidencia `skip`:

- `ADMIN-CHAT-003`
- `ECOM-AUTH-001`
- `ECOM-AUTH-002`
- `ECOM-AUTH-004`
- `ECOM-CATALOG-001`
- `ECOM-CATALOG-002`
- `ECOM-PAY-003`
- `ECOM-PROD-001`

Casos bloqueados por spec faltante y correctamente degradados:

- `ecommerce/e2e/ecommerce-readiness.spec.ts` esta completamente en `test.skip`.
- `ecommerce/e2e/admin-conversation-actions.spec.ts` esta en `test.skip`.
- `ECOM-PAY-001`
- `ECOM-PAY-002`
- `ADMIN-CHAT-011`
- `CROSS-016`

Estado:

- `ecommerce/e2e/mercadopago-success.spec.ts` no existe y hoy el gate falla correctamente por eso.

## Coverage tecnica insuficiente en backend core

Coverage observada hoy en archivos criticos:

| Archivo | Lineas | Funciones | Branches | Lectura |
| --- | ---: | ---: | ---: | --- |
| `backend/src/pricing/parametric-pricing.service.ts` | `3.47%` | `4.58%` | `1.55%` | riesgo critico en pricing core |
| `backend/src/storefront/payments/mercadopago.service.ts` | `25.65%` | `31.43%` | `19.17%` | pagos con hueco material |
| `backend/src/storefront/storefront.service.ts` | `46.44%` | `48.76%` | `39.98%` | storefront central solo parcialmente protegido |
| `backend/src/inbox/inbox.service.ts` | `11.62%` | `13.39%` | `6.93%` | conversaciones/manual ops con bajo control |
| `backend/src/analytics/analytics.service.ts` | `43.98%` | `41.98%` | `39.95%` | analytics estructural con cobertura media |
| `backend/src/orders/order-payment-settlement.service.ts` | `92.45%` | `100%` | `76.36%` | buen ejemplo de cobertura util |
| `backend/src/orders/order-stock-integrity.service.ts` | `85.42%` | `100%` | `58.93%` | buen ejemplo de cobertura util |

## Gaps por superficie

### Backend

- pricing parametrico sin cobertura proporcional a su criticidad;
- pagos con cobertura parcial y sin smoke feliz real del provider esperado;
- `inbox.service.ts` con baja cobertura para una superficie operativa sensible;
- servicios grandes de ordenes y storefront con partes extensas sin cubrir.

### Frontend storefront

- Vitest de utilidades/SEO ya fue recuperado y hoy corre en verde;
- search, canonicas, mobile y performance siguen sin cierre runtime;
- parte de catalogo, auth y PDP esta sostenida por specs `skip`.

### Frontend admin

- solo hay `7` archivos unitarios en el package `frontend`;
- la cobertura browser del admin vive en `ecommerce/e2e`, no en el admin mismo;
- no existe smoke autocontenido del admin core.

### Channel adapters

- hay cobertura real y valiosa;
- falta exponerla como suite de primera clase en scripts y CI.

## Acciones prioritarias de cobertura

1. Corregir el estado del workbook para los `8` casos aun sostenidos por `skip`.
2. Crear o restaurar cobertura real para pagos (`mercadopago-success`) y para readiness storefront.
3. Corregir el validador de gobernanza para que detecte `skip` y no solo rutas faltantes.
4. Subir la cobertura de `parametric-pricing.service.ts`, `mercadopago.service.ts`, `storefront.service.ts` e `inbox.service.ts`.
5. Introducir smoke browser core para `catalogo -> PDP -> carrito -> checkout` y `admin sign-in -> orden -> CMS`.
