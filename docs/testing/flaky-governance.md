# Flaky Governance

Fecha de auditoria: `2026-05-08`

## Estado observado hoy

- No se observo flakiness en las suites deterministicas ejecutadas:
  - `backend`
  - `frontend`
  - `services/channel-adapter`
  - `ai-platform/backend`
- La capa browser no se puede evaluar por estabilidad funcional porque hoy falla antes por dependencia de entorno.

## Fuentes probables de flakiness

### Dependencia de infraestructura externa

- Playwright depende de `localhost:3000`, `localhost:8080`, `127.0.0.1:4000` y en algunos flujos tambien `127.0.0.1:4110`.
- No hay `webServer` definido en `ecommerce/playwright.config.ts`.

Riesgo:

- falsos rojos por bootstrap;
- tiempos de readiness variables;
- dificultad para distinguir bug de producto vs bug de entorno.

### Esperas temporales y sleeps

Ejemplos detectados:

- `ecommerce/e2e/admin-conversations-inbox-regression.spec.ts`
- `ecommerce/e2e/admin-aberturas-ai-flows.spec.ts`
- `ecommerce/e2e/aberturas-chat-persistence-cross-scope.spec.ts`
- `ecommerce/e2e/storefront-webchat-authenticated-memory.spec.ts`
- `ecommerce/e2e/support/db.ts`
- `services/channel-adapter/src/channels/webchat/webchat.adapter.test.js`
- `services/channel-adapter/src/channels/meta/meta.adapter.test.js`

Riesgo:

- dependencia del reloj;
- sensibilidad a CPU lenta o I/O variable;
- retries que tapan problemas reales.

### Retries como mecanismo de ocultamiento

Playwright configura:

- `retries: process.env.CI ? 2 : 0`
- `workers: process.env.CI ? 1 : undefined`

Riesgo:

- un pipeline puede quedar verde por retry sin resolver la causa;
- no hay politica visible de cuarentena o degradacion de casos flaky.

### Suites con rutas faltantes toleradas por el runner

Casos observados:

- `test:e2e:critical` ya no tolera rutas faltantes;
- el riesgo residual ahora es workbook sostenido por specs `skip`.

Riesgo:

- la suite no es flaky: es peor, porque puede simular completitud sin ejecutar todo lo prometido.

### Clasificacion automatica ruidosa

El nuevo validador usa patrones `deferred` demasiado amplios y termina clasificando como diferidos casos con `domain` o `email`.

Riesgo:

- ruido en la auditoria;
- conclusiones operativas menos confiables;
- posibilidad de esconder deuda relevante bajo una etiqueta `deferred`.

## Reglas de gobernanza obligatorias

1. Ningun `retry green` cuenta como estable sin conservar el primer fallo como artefacto.
2. Todo `test.skip` debe reflejarse el mismo dia en el workbook como `DEFINIDA`, `pending` o `deferred`.
3. Toda ruta de spec declarada en scripts o manifest debe validarse antes de ejecutar el runner.
4. Todo `waitForTimeout`, `setTimeout` o sleep en E2E debe migrar a polling por estado observable cuando el flujo sea critico.
5. Toda fila workbook marcada como verde debe caer si su evidencia apunta a `skip`.
6. Ninguna suite AI o multicanal debe entrar al bloque default mientras commerce core siga inestable.

## Politica de clasificacion

| Tipo | Criterio | Accion |
| --- | --- | --- |
| `infra-flaky` | falla por servicios no listos, puertos o bootstrap | arreglar entorno o hacerlo autocontenido |
| `time-flaky` | depende de sleeps o delays fijos | reemplazar por espera de estado |
| `data-flaky` | depende de seed mutable o side effects | aislar fixtures y reset de datos |
| `false-green` | pasa con specs faltantes o evidencia `skip` | bloquear pipeline hasta sanear runner |
| `classification-noise` | regex de gobierno etiquetan mal bloques o targets | endurecer patrones antes de usar la señal para decisiones |

## Decision actual

- No hay evidencia para declarar flaky a backend/frontend/channel-adapter en esta corrida.
- Si hay evidencia para declarar `false-green risk` y `classification-noise` en la capa de gobernanza actual.
