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

Bloque profundo de conversación:

```bash
node tools/qa/run-qa.mjs --block ai-conversation-quality
```

Sync puntual del corpus real de WhatsApp:

```bash
node tools/qa/run-qa.mjs --block real-whatsapp-corpus-sync
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
- `.qa/latest.conversation-quality.json`
- `.qa/latest.conversation-quality.md`

## Informe granular de casos de uso

El reporte canónico y actualizable de cobertura del sistema queda en:

- [docs/qa/system-use-cases-report.xlsx](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/system-use-cases-report.xlsx)

Se regenera desde la fuente estructurada en:

- [tools/qa/use-cases-report.source.mjs](/Users/rodrigo/Git/personal/react_admin_dashboard/tools/qa/use-cases-report.source.mjs)

Comando de actualización:

```bash
node tools/qa/generate-use-cases-report.mjs
```

El workbook incluye también una capa explícita de estado por respuesta backend directa:

- `validado por UI`
- `validado por API directa`
- `pendiente de backend`
- `definido pero no cubierto`

Además agrega la hoja `Guia manual`, que consolida todos los casos de uso disponibles como índice de arranque para pruebas manuales transversales.

Regla de trabajo:

- todos los casos que no estén en `VERIFICADA` deben tener su prueba creada, validada, actualizada y ejecutada antes de habilitar una corrida manual de cierre;
- si un caso no tiene cobertura suficiente, se crea o actualiza el test correspondiente antes de usarlo como parte del checklist manual;
- la guía manual es un índice de ejecución final, no un sustituto de la automatización.
- quedan fuera del gate de esta entrega los casos de automatización de respuestas del agente, incluyendo `wording registry`, `hybrid intent`, `grounding`, `auto-reply` y similares; esos tests pueden existir, pero no bloquean el cierre manual-only de esta iteración.

Para bloques conversacionales, `run-qa` genera además un reporte agrupado por patrón, bucket probable, capa a ajustar y siguiente acción sugerida.

Si existe la carpeta externa de exports reales de WhatsApp, el loop conversacional también genera:

- `.qa/external-real-conversations/whatsapp/index.json`
- `.qa/external-real-conversations/whatsapp/summary.md`
- manifiestos normalizados por conversación
- propuestas automáticas de fixtures/regresiones

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

- `ai-conversation-quality`
- `real-whatsapp-corpus-sync`
- `storefront-e2e-critical`
- `storefront-e2e-auth-content`
- `storefront-e2e-account-notifications`
- `storefront-e2e-account-checkout`
- `backend-domain-core`
- `frontend-admin-unit`
- `quality-static`

Etiquetas nuevas relevantes del corpus real:

- `outbound_follow_up`
- `abandoned_thread`
- `reengagement_after_gap`
- `operational_thread_switch`
- `system_message_interference`

Perfiles explícitos del hilo en el corpus QA:

- `customer_initiated`
- `business_initiated`
- `channel_interfered`
