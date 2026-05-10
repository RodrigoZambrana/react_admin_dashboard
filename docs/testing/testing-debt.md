# Testing Debt

Fecha de relevamiento: `2026-05-08`

Deuda priorizada del ecosistema de pruebas.

## Crítica

| Deuda | Evidencia | Impacto | Acción recomendada |
| --- | --- | --- | --- |
| `ai-platform/frontend` sin tests | `package.json` no declara runner ni specs | Superficie sin protección | Mantener deferred hasta completar recovery determinístico |
| `services/channel-adapter` sin script formal | Hay `.test.js`, pero no `test` en `package.json` | Suite difícil de ejecutar en CI | Agregar script `test` y entrada de pipeline cuando se reactive el bloque |
| `ecommerce` Vitest no expuesto por script | Existe `ecommerce/vitest.config.ts`, pero `package.json` no tiene `test` | Specs de utilidad/SEO quedan fuera del flujo normal | Agregar `test:unit` o `test` y coverage gate |

## Alta

| Deuda | Evidencia | Impacto | Acción recomendada |
| --- | --- | --- | --- |
| Sin E2E propio en `frontend` | Sólo Vitest/RTL | Cambios visuales/flujo pueden romper sin browser | Agregar smoke Playwright mínimo |
| Suites pesadas sin separación de velocidad | `ai-platform/backend` usa `jest --runInBand` | Ejecución lenta y difícil de paralelizar | Separar smoke, dominio y arquitectura |
| Faltan fixtures/factories centralizados | Diversidad de tests por proyecto sin convención común | Duplica setup y aumenta flakes | Crear carpeta `test/fixtures` y builders por dominio |

## Media

| Deuda | Evidencia | Impacto | Acción recomendada |
| --- | --- | --- | --- |
| Sin estrategia de accesibilidad | No hay gate visible | Regresiones UX/a11y pasan desapercibidas | Agregar `axe`/Playwright a11y smoke |
| Sin visual regression formal | No se detectó paquete dedicado | Cambios visuales se revisan a mano | Agregar snapshots visuales sólo en flujos críticos |
| Sin CI matrix consolidada | Cada proyecto define sus propias reglas | Dificulta cobertura homogénea | Centralizar comandos en Makefile/CI |

## Baja

| Deuda | Evidencia | Impacto | Acción recomendada |
| --- | --- | --- | --- |
| Índice de docs de testing ausente | No existía `docs/testing/` | Descubribilidad baja | Mantener estos documentos como índice operativo |
| Convención de nombres heterogénea | Coexisten `spec`, `test`, `node:test`, Playwright | Fricción cognitiva | Documentar naming y boundaries por suite |

## Debt pattern observada

1. Hay cobertura real.
2. La cobertura no está organizada como sistema único.
3. Varias suites existen pero no entran naturalmente al flujo de ejecución.
4. Falta un contrato formal entre docs, runners y CI.

## Plan de recuperación sugerido

### Bloque 1

- Hacer ejecutables y visibles todas las suites existentes.
- Publicar comandos estándar por proyecto.

### Bloque 2

- Agregar cobertura al frontend sin tests.
- Agregar smoke browser al admin.

### Bloque 3

- Separar suites pesadas por dominio y por tiempo.
- Definir coverage gates realistas.

### Bloque 4

- Consolidar fixtures, factories y datos determinísticos.
- Conectar hallazgos manuales con regresión automática.

### Bloque diferido

- No iniciar recovery AI/conversational hasta cerrar las capas determinísticas del ecommerce core.
