# Backend Runtime Status

Fecha de evaluación: `2026-05-08`

## Resumen

La suite completa del backend corre en verde con Vitest.

- Comando validado: `cd backend && npm test`
- Resultado: `54` files passed, `274` tests passed
- Duración total observada: `3.19s`
- Observación importante: `npm test -- --runInBand` falla porque `runInBand` es un flag de Jest, no de Vitest
- Comando de coverage validado: `cd backend && npm run test:coverage`
- Coverage observada: `33.22%` statements, `26.25%` branches, `35.6%` functions, `33.43%` lines

## Matriz runtime inicial

| Suite | Tipo | Ejecuta | Estado | Duración | Flaky | Bloqueantes |
|---|---|---:|---|---|---|---|
| `src/budget/**`, `src/common/**`, `src/conversions/**`, `src/pricing/**`, `src/qa/**`, `src/users/**`, `src/customers/**`, `src/sales/utils/pricing.spec.ts` | unit / domain | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/auth/**` | unit / service / permissions | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/storefront/**` | integration / domain | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/orders/**` | integration / domain | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/accounting/**` | api / integration | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/email/**` | service / integration | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/inbox/**` | service / integration | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/cms/**` | service / domain | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/analytics/**` | service / integration | sí | green | incluido en la corrida total de `3.19s` | no observado | ninguno |
| `src/ai/**`, `src/knowledge/**` | deferred | sí, pero excluido del recovery determinístico | green baseline | incluido en la corrida total de `3.19s` | no evaluado en esta fase | fuera de alcance temporal |

## Clasificación operativa

### Tier 1 - Core deterministic

- `src/budget/**`
- `src/common/**`
- `src/conversions/**`
- `src/pricing/**`
- `src/qa/**`
- `src/users/**`
- `src/customers/**`
- `src/sales/utils/pricing.spec.ts`
- `src/auth/**`

### Tier 2 - Integration controlled

- `src/storefront/**`
- `src/orders/**`
- `src/accounting/**`
- `src/email/**`
- `src/inbox/**`
- `src/cms/**`
- `src/analytics/**`

### Tier 5 - Deferred AI

- `src/ai/**`
- `src/knowledge/**`

## Dependencias runtime observadas

- `Vitest` es el runner real del backend
- `Prisma` se usa en varios tests y scripts, pero la corrida principal no requirió DB real
- `Mercado Pago` aparece como deshabilitado en logs de test y no bloqueó el runtime
- `NestJS` arranca componentes de logging durante los tests, lo que deja trazas visibles pero no fallas

## Bloqueantes detectados

Ningún test falló en la corrida completa del backend.

El único bloqueante real encontrado fue de normalización de runner:

- `npm test -- --runInBand` falla porque Vitest no reconoce ese flag

## Recuperación inmediata recomendada

1. Mantener `test`, `test:unit`, `test:integration`, `test:api`, `test:smoke` y `test:coverage` como comandos estándar.
2. Usar `test:smoke` para la primera verificación rápida antes de tocar lógica.
3. Repetir `test:integration` por dominio cuando se empiecen a corregir bugs.
4. Mantener AI fuera del recovery inicial aunque siga inventariado.
5. Usar coverage como baseline, no como gate todavía, hasta separar mejor las capas y subir el mínimo útil por dominio.
