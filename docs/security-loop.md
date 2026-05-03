# Security Loop

El repositorio ahora tiene un loop centralizado en `scripts/security-loop.mjs` para detectar, clasificar, remediar y validar vulnerabilidades de `npm` en `frontend` y `backend`.

## Comandos

- `make security-audit`: corre `npm audit` y `npm audit --json` en ambos proyectos, genera `security/latest-report.json` y actualiza `security/vulnerability-log.json`.
- `make security-loop`: ejecuta el loop completo. Si encuentra vulnerabilidades `high` o `critical`, intenta `npm audit fix`, revalida builds y reinicia `local-test` con smoke tests.
- `npm run security:audit` dentro de `frontend` o `backend`: corre el escaneo solo para ese proyecto.

## Hooks activos

- `frontend`
  - `postinstall`
  - `predev`
  - `prebuild`
- `backend`
  - `postinstall`
  - `prestart:dev`
  - `prebuild`

Cada hook llama a `node ../scripts/security-loop.mjs gate --project <nombre> --phase <fase>`.

## Criterio de salida

El loop solo se considera exitoso cuando:

- no quedan vulnerabilidades `critical` o `high`
- las `moderate` restantes tienen decision documentada en `security/accepted-risks.json`
- `frontend` y `backend` construyen sin romperse
- `make local-test-reset` termina con los smoke tests en verde

## Artefactos

- `security/latest-report.json`: snapshot mas reciente de auditoria.
- `security/vulnerability-log.json`: historial consolidado de estado por dependencia.
- `security/baseline.json`: baseline aceptado mas reciente para comparar regresiones.
- `security/accepted-risks.json`: riesgos temporales aceptados con justificacion y fecha de revision.

## Escape hatch

Si necesitás desactivar temporalmente los hooks de seguridad para una investigacion local puntual, podés exportar `SECURITY_LOOP_SKIP=1`. No debe usarse para CI ni para builds regulares.
