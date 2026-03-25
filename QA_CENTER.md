# QA Center

Runner de QA por bloques para validar storefront, backend y admin sobre el entorno local.

## Comando base

```bash
node tools/qa/run-qa.mjs --all
```

## Variantes útiles

Listar bloques disponibles:

```bash
node tools/qa/run-qa.mjs --list
```

Correr un bloque puntual:

```bash
node tools/qa/run-qa.mjs --block storefront-e2e-account-checkout
```

Correr varios bloques:

```bash
node tools/qa/run-qa.mjs --block storefront-e2e-critical,backend-domain-core
```

Repetir la secuencia seleccionada:

```bash
node tools/qa/run-qa.mjs --all --repeat 2
```

## Resultados

Los resultados quedan persistidos en:

- `.qa/latest.json`
- `.qa/runs/<run-id>.json`
- `.qa/runs/<run-id>/*.log`

## Admin

El panel admin expone el viewer en:

- `/app/settings/qa`

Ese viewer no ejecuta las suites directamente. Muestra:

- catálogo y orden recomendado de bloques
- comandos de consola asociados
- último run
- historial reciente
- detalle por bloque y por paso

## Flujo operativo de tests

Este flujo pasa a formar parte de la estructura normal de trabajo para `backend`, `frontend` y `ecommerce`.

### Alta de funcionalidad

- definir qué capa cambia:
  - `backend`
  - `frontend admin`
  - `storefront`
  - interacción entre proyectos
- agregar o ampliar al menos una prueba en la capa de mayor riesgo:
  - unit/integration para lógica de dominio
  - E2E para flujos visibles o handoffs entre apps
- asociar el caso al bloque QA más cercano
- si el caso no entra bien en un bloque existente, crear uno nuevo en [tools/qa/manifest.json](/Users/rodrigo/git/personal/react_admin_dashboard/tools/qa/manifest.json)

### Modificación de funcionalidad

- identificar qué pruebas existentes validan el comportamiento que cambia
- actualizar esas pruebas al nuevo criterio esperado
- agregar regresión nueva si el cambio introduce:
  - nueva rama funcional
  - nueva combinación de estados
  - nuevo handoff entre proyectos
- no cerrar el cambio si el bloque QA impactado queda desalineado con la realidad del sistema

### Baja o retiro de funcionalidad

- eliminar o ajustar pruebas que validaban el comportamiento retirado
- quitar el caso del bloque QA correspondiente si ya no representa una superficie vigente
- si un bloque queda obsoleto por completo, removerlo del manifest
- documentar explícitamente la baja para evitar falsos fallos o expectativas viejas

### Regla transversal

- cada bug real detectado en pruebas manuales o QA exploratorio debe convertirse, cuando sea razonable, en una regresión automatizada
- toda modificación relevante debe terminar con:
  - pruebas actualizadas
  - bloque QA alineado
  - resultado verificable en consola o viewer admin

## Nota operativa sobre Playwright

Las suites browser reales dependen de que Chromium pueda abrirse en el host.

En sesiones sandboxed de Codex sobre macOS puede aparecer un error tipo:

- `MachPortRendezvousServer ... Permission denied`

Ese fallo no implica un bug del storefront. Implica que el browser no pudo lanzarse en ese entorno.

Para validar esos bloques:

- correr el comando desde una terminal local del host
- o usar una sesión con permisos suficientes para Playwright/Chromium

## Bloques actuales

- `storefront-e2e-critical`
- `storefront-e2e-auth-content`
- `storefront-e2e-account-notifications`
- `storefront-e2e-account-checkout`
- `backend-domain-core`
- `frontend-admin-unit`
- `quality-static`
