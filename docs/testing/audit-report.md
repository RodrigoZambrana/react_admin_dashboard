# QA Audit Report

Fecha de auditoria: `2026-05-08`

## Veredicto

El sistema no esta listo para QA manual.

Respuesta a la pregunta central:

> Si, hoy un bug critico real puede escapar de la automatizacion actual.

## Resumen ejecutivo

- El contrato funcional existe y es amplio: `Contrato vivo` contiene `146` casos, con `136` en `valid` y `10` en `pending`.
- La evidencia de ese contrato mejoro, pero todavia no es confiable de punta a punta: el runner ya falla por specs inexistentes, aunque todavia quedan `8` casos `valid` sostenidos por tests `skip`.
- El backend deterministico corre en verde y es la superficie mas estable hoy: `54` archivos, `274` tests, coverage total `33.22%` statements y `26.25%` branches.
- El frontend admin unitario corre en verde: `7` archivos, `26` tests.
- El `channel-adapter` corre en verde con `36` tests, pero no tiene script `test` en `package.json`.
- `ai-platform/backend` corre en verde con `91` suites y `454` tests, pero por estrategia debe quedar `deferred`.
- `ecommerce` unitario ya corre en verde: `7` archivos y `18` tests.
- La capa browser de `ecommerce` sigue sin estado gobernable: Playwright depende de servicios externos levantados manualmente y el flujo critico de Mercado Pago sigue bloqueado por spec inexistente.
- CI/CD no representa salud integral del sistema: solo existe un workflow visible para `analytics-health`.

## Evidencia runtime validada hoy

| Superficie | Comando | Resultado | Lectura |
| --- | --- | --- | --- |
| `backend` | `npm test` | `54` files, `274` tests, green | base deterministica sana |
| `backend` | `npm run test:coverage` | green, `33.22%` statements, `26.25%` branches | coverage insuficiente para gate global |
| `frontend` | `npm test` | `7` files, `26` tests, green | cobertura local util, sin browser |
| `ecommerce` unitario | `npm test` | `7` files, `18` tests, green | recuperado, util como gate local |
| `ecommerce` browser | `npx playwright test --list` | `93` tests en `49` archivos | inventario, no validacion |
| `ecommerce` smoke admin | `npx playwright test admin-signin-smoke.spec.ts --workers=1` | `2` failed por `ERR_CONNECTION_REFUSED` en `localhost:8080` | depende de entorno externo |
| `ecommerce` critical | `npm run test:e2e:critical` | `4` failed por `ECONNREFUSED` a `127.0.0.1:4000` | no hay runtime autocontenido |
| `services/channel-adapter` | `node --test src/**/*.test.js` | `36` pass | suite real, runner oculto |
| `ai-platform/backend` | `npm test` | `91` pass, `454` tests | inventariado, `deferred` |

## Hallazgos de gobierno

1. El workbook y el runtime quedaron mejor alineados en rutas reales, pero no en cobertura ejecutable: `8` casos `valid` siguen apuntando a specs `skip`.
2. `ecommerce/test:e2e:critical` ya rompe correctamente por `mercadopago-success.spec.ts` inexistente.
3. `ecommerce/e2e/ecommerce-readiness.spec.ts` sigue teniendo cuatro casos `test.skip`, pero todavia sostiene varios casos `VERIFICADA`.
4. `ecommerce/e2e/admin-conversation-actions.spec.ts` sigue en `skip` y aun asi sostiene al menos un caso admin marcado como cubierto.
5. `tools/qa/validate-governance.mjs` no detecta falso verde por `skip` en el workbook: hoy informa `False-green candidates: 0` aunque siguen existiendo casos afectados.
6. La clasificacion `deferred` del nuevo validador es demasiado amplia: por regex marca bloques `backend-domain-*` y targets con `email` como diferidos, lo que vuelve ruidosa esa señal.
7. La estrategia acordada sigue desviada en el manifest de QA: los bloques por defecto incluyen IA y conversaciones antes de cerrar recovery deterministico core.

## Matriz obligatoria

| Dominio | Cobertura | Runtime | Riesgo | Criticidad | Estado | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| Backend auth y ordenes controladas | buena en servicios puntuales | verde hoy | medio | alta | parcial | falta elevar coverage global y proteger servicios grandes no testeados |
| Pricing parametrico | muy baja | backend green, pero coverage de archivo `3.47%` lineas | alto | critica | abierto | logica core puede romper sin ser detectada |
| Checkout y pagos | E2E declarada, backend parcial | el gate ahora falla correctamente por `mercadopago-success.spec.ts` inexistente | muy alto | critica | bloqueado | el flujo feliz de Mercado Pago no existe como spec real |
| Catalogo, PDP y auth storefront | cobertura mixta | workbook sigue usando `ecommerce-readiness.spec.ts`, hoy con `skip` | alto | critica | falso verde | casos marcados `VERIFICADA` sin runtime efectivo |
| Search, canonicas, analytics estructural, mobile, performance | `DEFINIDA`, no `VERIFICADA` | sin rerun valido hoy | alto | alta | pendiente | faltan pruebas activas y evidencia nueva |
| Admin browser workflows | amplia declaracion en Playwright | no ejecutable sin `localhost:8080` y varios bloques mezclan IA | alto | alta | parcial | sin smoke autocontenido del admin core |
| Channel adapters | buena a nivel unitario | verde hoy | medio | media | parcial | no hay script ni gate CI formal |
| CI/CD y quality gates | baja | solo `analytics-health` visible | muy alto | critica | abierto | merges pueden pasar sin reflejar salud transversal |
| AI y conversacional | extensa pero fuera de prioridad | verde en `ai-platform/backend` | controlado si se difiere | media | diferido | no debe bloquear ecommerce core |

## Bloqueos antes de QA manual

- bajar a `DEFINIDA` o `pending` toda fila del workbook sostenida por evidencia `skip` o inexistente;
- bajar a `DEFINIDA` los `8` casos del workbook que siguen dependiendo de specs `skip`, o reactivar esas specs;
- convertir Playwright en suite autocontenida o documentar un bootstrap obligatorio y verificable;
- mantener el hard-fail de specs inexistentes y extenderlo al manifest completo;
- corregir `validate-governance` para que detecte `skip` en evidencia workbook y no difiera por regex demasiado amplias;
- definir un gate CI transversal minimo para `backend`, `frontend`, `ecommerce` y `channel-adapter`.
