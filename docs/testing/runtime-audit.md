# Runtime Audit

Fecha de auditoria: `2026-05-08`

## Corridas ejecutadas

| Comando | Resultado | Evidencia clave |
| --- | --- | --- |
| `cd backend && npm test` | green | `54` files, `274` tests, `3.47s` |
| `cd backend && npm run test:coverage` | green | `33.22%` statements, `26.25%` branches |
| `cd frontend && npm test` | green | `7` files, `26` tests, `2.11s` |
| `cd ecommerce && npm test` | green | `7` files, `18` tests |
| `cd services/channel-adapter && node --test src/**/*.test.js` | green | `36` tests, `0` skipped |
| `cd ai-platform/backend && npm test` | green | `91` suites, `454` tests |
| `cd ecommerce && npx playwright test --list` | inventory only | `93` tests en `49` archivos |
| `curl http://127.0.0.1:3000` | fail | `Couldn't connect to server` |
| `curl http://127.0.0.1:8080` | fail | `Couldn't connect to server` |
| `cd ecommerce && npx playwright test admin-signin-smoke.spec.ts --workers=1` | fail | `ERR_CONNECTION_REFUSED` a `http://localhost:8080/sign-in` |
| `cd ecommerce && npm run test:e2e:critical` | fail | `ECONNREFUSED 127.0.0.1:4000` contra `api/storefront/products/...` |
| `cd ecommerce && npm run test:integrity` | fail controlado | solo `missing-target: mercadopago-success.spec.ts` en `test:e2e:critical` |

## Anomalias de runtime

### 1. Suite recuperada y ahora util

`ecommerce` Vitest ya entrega valor de proteccion local. Hoy corrio `7` archivos y `18` tests en verde.

Impacto:

- la capa utilitaria de SEO, analytics y rich text vuelve a ser ejecutable;
- el principal hueco runtime se desplaza a browser y gobernanza workbook.

### 2. E2E no autocontenida

Playwright usa `http://localhost:3000` como `baseURL`, y varias specs navegan directo a `http://localhost:8080` o consumen `http://127.0.0.1:4000/api/storefront`.

Runtime validado hoy:

- `3000` no responde;
- `8080` no responde;
- el smoke admin cae por `ERR_CONNECTION_REFUSED`;
- el bloque critico cae por `ECONNREFUSED` al backend.

Lectura:

- la suite browser no puede considerarse gate estable si el bootstrap del entorno no forma parte del propio runner.

### 3. Validacion de integridad todavia incompleta

`npm run test:integrity` ya rompe por `mercadopago-success.spec.ts` faltante, pero no detecta workbook sostenido por specs `skip`.

Lectura:

- la proteccion por rutas mejoro;
- la proteccion por ejecutabilidad de la evidencia todavia es insuficiente.

### 4. Script critico con spec inexistente

`ecommerce/package.json` define:

- `test:e2e:critical = playwright test --workers=1 commerce-critical.spec.ts mercadopago-success.spec.ts`

Ahora `test:e2e:critical` valida targets antes de correr Playwright y falla de inmediato por `mercadopago-success.spec.ts` faltante.

Lectura:

- este bloqueo ya es correcto y debe mantenerse hasta restaurar o reemplazar la spec.

### 5. Workbook con evidencia `skip` no detectada por el validador

El workbook actual todavia tiene `8` casos `valid` que apuntan a:

- `ecommerce/e2e/ecommerce-readiness.spec.ts`
- `ecommerce/e2e/admin-conversation-actions.spec.ts`

Ambas siguen conteniendo `test.skip`.

Lectura:

- `False-green candidates: 0` no es una señal confiable todavia.

## Estado de suites `skip` y `only`

- `.only`: no se detectaron ocurrencias en fuentes de test inspeccionadas.
- `test.skip`: se detectaron cinco casos activos en browser:
  - `ecommerce/e2e/ecommerce-readiness.spec.ts`: `4`
  - `ecommerce/e2e/admin-conversation-actions.spec.ts`: `1`

## Estado de runtime por capa

| Capa | Estado hoy | Confiabilidad |
| --- | --- | --- |
| backend unit/integration | verde | alta |
| frontend admin unit | verde | media |
| ecommerce src vitest | verde | media |
| ecommerce browser | bloqueada por entorno y por spec faltante en Mercado Pago | baja |
| channel-adapter | verde | media, por falta de gate formal |
| ai-platform/backend | verde | media, pero `deferred` |

## Conclusiones de runtime

1. El backend es la unica base claramente estable para recovery deterministico.
2. `ecommerce` ya tiene una suite local gobernable en Vitest, pero no una suite browser core gobernable.
3. El validador nuevo resuelve el caso de specs faltantes, pero no el de evidencia workbook basada en `skip`.
4. La automatizacion browser necesita bootstrap verificable, la restauracion o sustitucion de Mercado Pago y verificacion real contra el workbook.
