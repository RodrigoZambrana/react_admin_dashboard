# E2E Delegation Plan

## Propósito

Definir una delegación operativa real para la fase `Product Readiness / E2E Commerce`, priorizando:

- reducción de riesgo en el flujo comercial real,
- claridad de ownership por frente,
- integración ordenada a `develop`,
- y control explícito de solapamientos entre workstreams.

Fecha de referencia: `2026-03-22`

## Criterios de delegación

- El frente principal ya no es limpieza general de storefront.
- Las mejoras menores de storefront quedan fuera del camino crítico y pasan a backlog/incidencia puntual.
- El camino crítico actual es:
  - pago,
  - post-pago,
  - checkout/fulfillment,
  - stock,
  - QA end-to-end.
- No conviene separar en ramas totalmente independientes los bloques que escriben sobre los mismos módulos de backend si eso luego obliga a resolver merges conflictivos innecesarios.

## Estrategia de ramas e integración

### Fase de exploración

La exploración puede correr en paralelo sin costo de merge, porque es read-only.

Workstreams de exploración activos:

1. `payments-semantics`
2. `post-payment-orchestration`
3. `checkout-fulfillment`
4. `stock-order-integrity`
5. `e2e-test-design`

### Fase de implementación

A nivel de implementación, la separación recomendada no es idéntica a la exploración.

Bloques recomendados de implementación:

1. `codex/e2e-payments-core`
   - combina:
     - `payments-semantics`
     - `post-payment-orchestration`
   - motivo:
     - ambos tocan `backend/src/storefront/payments`,
     - `backend/src/storefront/storefront.service.ts`,
     - estados de orden,
     - timeline,
     - notificaciones y mails post-pago.
   - dividirlos en ramas completamente separadas aumentaría riesgo de conflictos y de decisiones inconsistentes.

2. `codex/e2e-checkout-fulfillment`
   - foco:
     - datos públicos de entrega,
     - contrato storefront/backend,
     - checkout UI,
     - DTOs y validaciones.

3. `codex/e2e-stock-policy`
   - foco:
     - política de stock,
     - reserva/decremento/reversión,
     - validación final en creación de orden y post-pago.
   - puede empezar parcialmente en paralelo, pero debe integrarse después de cerrar la semántica de pago.

4. `codex/e2e-qa-closure`
   - foco:
     - checklist,
     - fixtures,
     - recorrido funcional,
     - criterios de aceptación del flujo E2E.

Orden de integración sugerido a `develop`:

1. `codex/e2e-payments-core`
2. `codex/e2e-checkout-fulfillment`
3. `codex/e2e-stock-policy`
4. `codex/e2e-qa-closure`

## Subagentes lanzados primero

### 1. `payments-semantics`

Alcance:

- definir semántica canónica de estados de pago;
- determinar cuándo una orden pasa realmente a `PAID`;
- revisar consistencia entre `paymentIntent`, `Payment`, orden y storefront.

Módulos bajo responsabilidad:

- `backend/src/storefront/payments`
- `backend/src/storefront/storefront.service.ts`
- `backend/src/accounting`
- `ecommerce/src/page-sections/payment`
- `ecommerce/src/app/(storefront)/(checkout)`

Dependencias:

- ninguna previa bloqueante;
- debe informar primero el bloque crítico.

Salida esperada:

- matriz canónica de estados;
- inconsistencias actuales;
- puntos exactos de código a corregir;
- propuesta concreta de implementación.

Branch sugerida para implementación posterior:

- `codex/e2e-payments-core`

### 2. `post-payment-orchestration`

Alcance:

- cerrar qué debe pasar después de un pago confirmado;
- consolidar timeline, notificaciones y mails;
- revisar idempotencia y carreras entre webhook, storefront y accounting.

Módulos bajo responsabilidad:

- `backend/src/notifications`
- `backend/src/email`
- `backend/src/orders`
- `backend/src/storefront/payments`
- `backend/src/accounting`

Dependencias:

- depende conceptualmente de `payments-semantics`;
- pero puede explorar en paralelo para acelerar decisiones.

Salida esperada:

- cadena de eventos actual;
- huecos funcionales;
- riesgos de doble disparo o disparo ausente;
- integración objetivo.

Branch sugerida para implementación posterior:

- `codex/e2e-payments-core`

### 3. `checkout-fulfillment`

Alcance:

- relevar datos públicos necesarios para envío/entrega;
- comparar storefront actual contra capacidades reales de backend/admin;
- definir el mínimo operativo para checkout real.

Módulos bajo responsabilidad:

- `ecommerce/src/state/checkout-context.tsx`
- `ecommerce/src/page-sections/checkout`
- `backend/src/orders`
- DTOs/controladores de órdenes y delivery
- vistas admin ligadas a entrega/shipping

Dependencias:

- puede explorar en paralelo con pagos/post-pago;
- implementación depende de no romper el camino crítico de orden/pago.

Salida esperada:

- gap list de fulfillment;
- contrato mínimo recomendado;
- archivos exactos a tocar;
- propuesta de rollout.

Branch sugerida para implementación posterior:

- `codex/e2e-checkout-fulfillment`

### 4. `stock-order-integrity`

Alcance:

- mapear ciclo actual de stock desde catálogo hasta orden/pago;
- definir política MVP para reserva/decremento/reversión;
- contemplar variantes y productos paramétricos.

Módulos bajo responsabilidad:

- `backend/src/products`
- `backend/src/orders`
- `backend/src/storefront`
- modelos Prisma asociados
- uso público de disponibilidad en storefront

Dependencias:

- explora en paralelo;
- implementación conviene integrarla después de fijar la semántica de pago.

Salida esperada:

- lifecycle actual de stock;
- huecos operativos;
- política MVP recomendada;
- puntos de código concretos.

Branch sugerida para implementación posterior:

- `codex/e2e-stock-policy`

### 5. `e2e-test-design`

Alcance:

- diseñar checklist y matriz de pruebas del flujo completo;
- preparar el criterio de cierre del bloque E2E.

Módulos bajo responsabilidad:

- storefront activo
- checkout/payment flow
- mails/notificaciones visibles
- docs del proyecto y rutas públicas relevantes

Dependencias:

- puede arrancar ya;
- su ejecución real fuerte depende de 1 a 4.

Salida esperada:

- checklist ejecutable;
- matriz crítica/importante;
- fixtures y precondiciones;
- evidencia esperada de cierre.

Branch sugerida para implementación posterior:

- `codex/e2e-qa-closure`

## Trabajo local del agente principal en paralelo

Mientras los subagentes exploran, el trabajo local principal debe ser:

1. consolidar hallazgos y resolver solapamientos entre workstreams;
2. decidir qué cambios conviene implementar juntos en una sola rama para reducir conflictos;
3. mantener actualizados:
   - `PROJECT_STATUS.md`,
   - `EXECUTION_ROADMAP.md`,
   - documentación específica de la fase;
4. elegir el orden real de implementación una vez aparezcan hallazgos concretos;
5. mantener el criterio de validación:
   - lint/build,
   - y Docker local al cierre de cada bloque relevante.

## Riesgos de integración ya identificados

- `payments-semantics` y `post-payment-orchestration` comparten demasiados puntos de escritura para implementarse totalmente separados.
- `checkout-fulfillment` puede tocar DTOs y creación de orden; si se implementa antes de fijar pagos, puede generar retrabajo.
- `stock-order-integrity` depende de la semántica final de creación/cierre de orden para no definir una política equivocada.
- `e2e-test-design` no debe convertirse en pruebas definitivas antes de estabilizar los tres bloques anteriores.

## Criterio de cierre de la delegación inicial

La delegación inicial se considera bien montada cuando:

- cada workstream entrega hallazgos concretos y repo-específicos;
- queda claro qué cambios van juntos en una misma rama de implementación;
- el orden de integración a `develop` ya no depende de supuestos sino de evidencia del código.

## Estado de ejecución

### Primera ola ya aterrizada

- `codex/e2e-payments-core`
  - slice 1 implementado:
    - storefront ya no promueve órdenes a `PAID` por adjuntar un intent;
    - `authorized` deja de considerarse pago liquidado;
    - attach/webhook recalculan financieros tras espejar el `Payment`;
    - la UI pública ya no deja continuar como si `pending` / `in_process` / `authorized` fueran confirmación final.

### Próxima ola inmediata

- completar `codex/e2e-payments-core` con la parte restante:
  - tests de integración más cercanos al flujo real,
  - cierre de drift residual entre path manual/accounting y path automático,
  - luego habilitar paso a `codex/e2e-checkout-fulfillment`.

### Estado actualizado

- `codex/e2e-payments-core`
  - remanente inmediato reforzado:
    - `storefront.service.spec.ts` cubre `createOrder` con `paymentIntentId` adjunto y estado `authorized`,
    - se verifica que la orden no pase a `PAID` antes de confirmación real,
    - y que el snapshot de entrega persista junto con la orden.
- `codex/e2e-checkout-fulfillment`
  - primer slice ya aterrizado:
    - `GET /api/storefront/shipping-options`,
    - `shippingOptionId` en contrato público,
    - selección obligatoria en checkout,
    - suma de `deliveryFees` en totales,
    - snapshot de entrega en `createOrder`.
  - segundo slice ya aterrizado:
    - `fulfillmentMode` público explícito (`home_delivery`),
    - snapshot de entrega visible en review/confirmación,
    - primera capa de `stock-order-integrity` con commit al crear orden y release al cancelar.
- siguiente paso del frente:
  - política restante de stock/reversión ya cerrada:
    - una orden cancelada no se reactiva,
    - `reabrir/repetir/regenerar` crean una orden nueva;
  - pasar a checklist operativo y QA E2E del flujo comercial completo,
  - manteniendo el remanente de pagos ya dentro del checklist final E2E y no como bloque principal separado.
