# Coverage Analysis

Fecha de relevamiento: `2026-05-08`

Análisis de cobertura funcional y técnica del ecosistema de tests.

## Cobertura fuerte

### Ecommerce crítico

- Checkout, carrito, auth, success, purchase flow.
- SEO y metadata básica.
- Analytics estructural.
- Varias regresiones de admin cross-project.

### Backend de dominio

- Auth, orders, pricing, analytics, CMS, inbox y storefront APIs.
- Validaciones y servicios de negocio con buena dispersión por carpeta.

## Cobertura parcial

### Storefront

- Hay E2E reales, pero la cobertura está concentrada en flujos críticos.
- Faltan más casos sistemáticos de navegación, búsqueda, filtros, hydration y error states.

### Admin

- La cobertura actual sostiene flujos de operación concretos.
- Faltan browser regressions más amplias para permisos, ABMs completos y cambios de contenido con impacto en storefront.

### Channel adapter

- Los casos existen, pero sin runner formal y sin una estrategia visible de CI.

## Cobertura diferida

### `ai-platform/backend`

- Gran parte del runtime conversacional y de knowledge management.
- Policies, guardrails, fallback, prompt assembly y arquitectura.
- Clasificado como `deferred` para este recovery.

### `ai-platform/frontend`

- No se detectó cobertura declarada.
- Si la app está en uso real, esta es una deuda crítica.
- Queda fuera de la fase actual.

### AI / conversational flows

- Se mantienen fuera del ciclo de cobertura inicial.

## Cobertura débil o ausente

### Accesibilidad

- No se observó una estrategia consistente de `axe` o gating a11y.

### Performance

- No se observó suite de performance automatizada.

### Visual regression

- No se observó una base clara de snapshots visuales mantenibles.

### API contract testing explícito

- Hay tests de dominio y servicios, pero no una capa homogénea de contrato por endpoint crítico en todos los proyectos.

## Gaps prioritarios

1. Formalizar el runner de `ecommerce/src` para que sus specs no queden “silenciosos”.
2. Formalizar el runner de `services/channel-adapter`.
3. Separar smoke/regression en `ecommerce` y `frontend`.
4. Agregar browser coverage sistemático para admin.
5. Cubrir errores y edge cases de checkout/pagos con más profundidad.
6. Agregar accesibilidad y una mínima validación visual.
7. Mantener AI/conversational flows completamente fuera de esta etapa.

## Riesgos funcionales asociados

- Un fix en storefront puede romper admin cross-project sin detectarse si no hay regresión de handoff.
- Cambios en CMS o SEO pueden alterar rutas canónicas y metadata sin cobertura browser suficiente.
- Los paquetes sin runner formal tienden a acumular deuda porque sus tests no entran al ciclo natural de mantenimiento.

## Recuperación recomendada

### Fase 1

- Hacer ejecutables y visibles todos los runners existentes.
- Separar smoke de suites pesadas.

### Fase 2

- Cubrir el frontend sin tests.
- Subir la cobertura browser mínima del admin.

### Fase 3

- Agregar gates de a11y y contrato API para dominios críticos.

### Fase 4

- Reglas de coverage por proyecto y reporte consolidado en CI.
