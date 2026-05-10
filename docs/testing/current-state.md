# Testing Current State

Fecha de relevamiento: `2026-05-08`

Este documento resume el estado real del ecosistema de testing del repo y sirve como punto de partida para recuperación progresiva de cobertura, estabilidad y CI.

## Resumen ejecutivo

El repositorio tiene testing real, pero está fragmentado por proyecto y con distintos niveles de madurez:

- `ecommerce` concentra la mayor parte del valor funcional visible y tiene la mejor cobertura end-to-end.
- `backend` tiene una base amplia de tests de dominio y contratos.
- `frontend` tiene tests unitarios/componentes, pero no cobertura browser real.
- `ai-platform/backend` tiene una suite extensa basada en `jest`, pero queda fuera del recovery inicial porque es una superficie AI diferida.
- `ai-platform/frontend` no expone tests y también queda diferida.
- `services/channel-adapter` tiene tests de `node:test`, pero no un runner explícito en `package.json`.

Además existe una capa operativa de QA manual y de contrato vivo:

- [docs/qa/manual-functional-master.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/manual-functional-master.md)
- [docs/qa/system-use-cases-report.xlsx](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/system-use-cases-report.xlsx)
- [tools/qa/use-cases-report.source.mjs](/Users/rodrigo/Git/personal/react_admin_dashboard/tools/qa/use-cases-report.source.mjs)
- [docs/QA_CENTER.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/QA_CENTER.md)

## Estado por proyecto

| Proyecto | Runner principal | Cobertura visible | Señal de madurez |
| --- | --- | --- | --- |
| `ecommerce` | Playwright + Vitest config | 56 specs detectadas: 49 E2E y 7 utilitarias | Alta en flujos críticos, baja integración de unit tests en scripts |
| `frontend` | Vitest + RTL | 7 tests | Base sana, sin browser E2E |
| `backend` | Vitest | 54 tests | Cobertura de dominio amplia y consistente |
| `ai-platform/backend` | Jest + Supertest | 91 tests | Diferido en esta fase por estrategia AI-out |
| `ai-platform/frontend` | Ninguno expuesto | 0 tests | Diferido y sin cobertura declarada |
| `services/channel-adapter` | `node:test` dentro de archivos `.test.js` | 7 tests | Cobertura útil, pero sin script formal |

## Observaciones clave

### Ecommerce

- Tiene la mejor combinación de `E2E` y pruebas de utilidades/SEO.
- El paquete expone `playwright` como suite operativa.
- Hay un `vitest.config.ts`, pero el `package.json` no ofrece un script `test` para esa capa.
- El coverage browser existe y es el más cercano a un gate real de producción.

### Frontend admin

- Tiene `vitest` configurado con `jsdom` y `setupTests`.
- La cobertura está concentrada en componentes, utilidades y pantallas específicas.
- No hay E2E browser expuesto en este package.

### Backend

- Tiene la mejor distribución de tests de dominio por carpeta.
- El stack está unificado en `vitest`.
- Cubre auth, analytics, inbox, storefront, pricing, orders, CMS, email y soporte AI.

### AI platform backend

- Tiene una suite grande con `jest --runInBand`.
- La cobertura es fuerte en arquitectura, policy, runtime y pipeline conversacional.
- Para esta etapa queda clasificado como `deferred`.

### AI platform frontend

- No hay tests declarados.
- Si esta app sigue vigente, esta es la deuda más obvia de todo el ecosistema.
- No entra en la fase actual de recovery.

### Channel adapter

- Hay tests reales sobre canales y runtime.
- Falta formalizar su ejecución como suite de primera clase.

## Riesgos actuales

1. Cobertura no homogénea entre proyectos.
2. Suites existentes sin script de entrada claro.
3. Ausencia de browser tests en admin y en `ai-platform/frontend`.
4. Riesgo de drift entre docs funcionales y automatización.
5. Falta de una estrategia común de fixtures/factories.
6. Falta de separación nítida entre smoke, regresión y dominio.
7. Superficies AI que compiten con el recovery determinístico y deben mantenerse fuera de este ciclo.

## Qué se debe hacer primero

1. Formalizar runners y comandos de cada suite.
2. Separar smoke, regresión y suites pesadas.
3. Agregar cobertura a los módulos sin tests.
4. Alinear fixtures y datos determinísticos.
5. Conectar hallazgos manuales con regresiones automáticas.

## Límite de esta auditoría

Este documento es una auditoría estática de estado actual. No reemplaza ejecución completa de las suites ni inspección runtime.
