# Backend Flaky Analysis

Fecha de evaluación: `2026-05-08`

## Estado actual

En la corrida de baseline no se observó flakiness.

- `54` suites pasaron
- `274` tests pasaron
- no hubo retries
- no hubo timeouts
- no hubo fallas intermitentes detectadas

## Hotspots potenciales

### 1. Scripts y bootstrap

- `backend/scripts/bootstrap-fresh-local-db.sh`
- `backend/scripts/bootstrap-consolidated-schema-local-db.sh`
- `backend/scripts/prepare-regression-state.sh`

Riesgo:

- dependen de variables de entorno y de una base local consistente
- pueden parecer flakey si el entorno no está alineado

### 2. Suites con Prisma y datos

- `src/orders/**`
- `src/accounting/**`
- `src/email/**`
- `src/inbox/**`
- `src/cms/**`
- `src/analytics/**`
- `src/storefront/**`

Riesgo:

- si se convierten en integration real con DB, el orden de seeds y el estado de la base puede introducir inestabilidad

### 3. Suites con mocks muy extensos

- `src/budget/**`
- `src/auth/**`
- `src/pricing/**`
- `src/sales/**`

Riesgo:

- un mock demasiado amplio puede ocultar dependencia real y hacer que el test pase sin representar el runtime

## Qué no se considera flaky por ahora

- los warnings de `MercadoPagoService`
- los warnings de `StorefrontService`
- la falta de `runInBand` en Vitest

## Protocolo de medición siguiente

1. Repetir `npm run test:smoke` tres veces.
2. Repetir `npm run test:integration` dos veces.
3. Marcar flaky sólo si hay fallas no determinísticas o variación de resultado.
4. Registrar cualquier dependencia de orden, seed o reloj.

