# QA Iterations Backlog

Fecha base: `2026-05-09`

## Propósito

Este documento traduce la estrategia de [qa-readiness-roadmap.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/qa-readiness-roadmap.md) a un backlog operativo por iteraciones.

Regla de uso:

- cada iteración debe cerrar con evidencia runtime;
- cada iteración debe dejar trazabilidad actualizada;
- cada iteración debe tener un prompt de ejecución para el agente implementador;
- no se avanza a la siguiente iteración si la anterior no cumple su criterio de salida.

## Cadencia sugerida

Este backlog está pensado para ejecutarse en `3` iteraciones consecutivas.

Duración sugerida:

- Iteración 1: `1` semana
- Iteración 2: `1` semana
- Iteración 3: `1` semana

Si se trabaja por sprint:

- tratar cada iteración como un bloque cerrado con gate de salida explícito.

## Objetivo global del backlog

Llegar a un estado donde:

- la automatización represente la salud real del sistema;
- los dominios funcionales core estén protegidos;
- el workbook refleje ejecución reciente real;
- QA manual pueda empezar como validación exploratoria/final y no como descubrimiento básico.

---

## Iteración 1

### Objetivo

Cerrar gobernanza, trazabilidad e integridad multi-workspace.

### Alcance

- workbook
- `test:integrity`
- runners core
- manifest QA
- separación core vs deferred

### Trabajo obligatorio

1. endurecer validación de integridad:
   - detectar specs faltantes
   - detectar `skip` sosteniendo cobertura declarada
   - detectar evidencia workbook inválida
   - detectar runners huérfanos
2. alinear workbook:
   - degradar casos que no tengan evidencia ejecutable real
   - actualizar fechas de validación cuando haya rerun real
3. normalizar scripts core:
   - `backend`
   - `frontend`
   - `ecommerce`
   - `services/channel-adapter`
4. confirmar que AI/conversation quede fuera del gate core
5. documentar resultados en `docs/testing`

### Entregables

- integridad multi-workspace ejecutable
- workbook sin falsos verdes
- scripts core explícitos
- reporte de gobernanza actualizado

### Artefactos esperados

- `docs/qa/system-use-cases-report.xlsx`
- `tools/qa/use-cases-report.source.mjs`
- `tools/qa/validate-governance.mjs`
- `tools/qa/manifest.json`
- reportes en `docs/testing`

### Criterio de salida

- `test:integrity` verde en workspaces core
- sin casos `VERIFICADA` sostenidos por `skip`
- sin specs faltantes en gates críticos
- workbook alineado con el repo real

### Riesgos que deben bajar

- falso verde
- deriva entre runner y workbook
- claims de cobertura sin evidencia ejecutable

### Prompt operativo para el agente

```text
Actuá como QA governance engineer y test infrastructure owner.

Objetivo de esta iteración:
cerrar integridad, trazabilidad y gobernanza multi-workspace del sistema antes de ampliar cobertura funcional.

Trabajo obligatorio:
1. auditar y endurecer `test:integrity` en workspaces core
2. detectar y eliminar falso verde del workbook
3. alinear runners y manifest QA con el estado real del repo
4. asegurar que AI/conversation quede fuera del gate core
5. ejecutar validaciones reales y actualizar documentación

Restricciones:
- no aceptar casos verdes sostenidos por `skip`
- no aceptar specs faltantes
- no asumir cobertura sin runtime
- no mezclar deferred dentro del core

Entregables:
- cambios concretos en validadores/runners
- workbook alineado
- evidencia de ejecución real
- lista de archivos modificados
- estado final de integridad

Criterio de éxito:
- `test:integrity` verde
- workbook sin falso verde
- runners core formalizados
```

---

## Iteración 2

### Objetivo

Cerrar deterministic core y smoke browser core.

### Alcance

- backend
- frontend
- ecommerce unitario
- channel-adapter
- storefront/admin smoke

### Trabajo obligatorio

1. consolidar deterministic core:
   - backend domain core
   - backend domain extended crítico
   - frontend admin unit
   - ecommerce vitest
   - channel-adapter
2. elevar cobertura útil en dominios de mayor riesgo:
   - pricing
   - payments
   - storefront service
   - inbox/manual ops críticos
3. cerrar smoke browser core:
   - home
   - catálogo
   - PDP
   - carrito
   - checkout
   - pagos
   - auth
   - admin sign-in
   - admin order detail
4. estabilizar bootstrap de entorno browser
5. documentar estado de cobertura por dominio

### Entregables

- suites core verdes
- smoke browser core verde
- matriz de cobertura por dominio actualizada
- reporte de gaps reducido

### Artefactos esperados

- scripts de suite por workspace
- specs core browser
- reportes `coverage-gaps`, `runtime-audit`, `critical-risk-report`

### Criterio de salida

- deterministic core verde
- smoke browser core verde
- pagos y checkout protegidos
- auth y storefront core protegidos
- bootstrap browser reproducible

### Riesgos que deben bajar

- roturas visibles del producto
- lógica crítica no protegida
- falsas garantías de estabilidad del storefront/admin core

### Prompt operativo para el agente

```text
Actuá como test implementation lead con foco en deterministic core y browser smoke.

Objetivo de esta iteración:
dejar verdes y confiables las capas que deben detectar bugs básicos antes de cualquier QA manual.

Trabajo obligatorio:
1. consolidar suites core de backend/frontend/ecommerce/channel-adapter
2. elevar cobertura útil en pricing, payments, storefront e inbox crítico
3. cerrar y estabilizar smoke browser core de storefront y admin
4. ejecutar validaciones reales
5. actualizar documentación de cobertura y riesgo

Restricciones:
- no aumentar volumen de tests sin reducir riesgo real
- no aceptar smoke verde con entorno frágil
- no mezclar AI en el gate core

Entregables:
- suites verdes
- smoke browser verde
- dominios core mejor protegidos
- reporte de qué gaps críticos siguen abiertos

Criterio de éxito:
- deterministic core verde
- smoke browser core verde
- cobertura crítica útil mejorada
```

---

## Iteración 3

### Objetivo

Cerrar cross-project, consolidar señal de release y preparar entrada a QA manual.

### Alcance

- handoffs entre apps
- notificaciones
- analytics estructural
- sesiones cross-app
- integraciones críticas
- `run-qa`
- `test:all`
- CI/CD quality gates

### Trabajo obligatorio

1. cerrar bloques cross-project:
   - storefront -> backend
   - checkout -> orders
   - orders -> notifications
   - storefront -> admin
   - payments -> admin reconciliation
   - analytics estructural
   - cross-app session
2. consolidar `run-qa`
3. consolidar `test:all`
4. endurecer quality-static y gates CI
5. actualizar workbook con evidencia reciente real
6. dejar explícito qué queda deferred y qué no bloquea QA manual

### Entregables

- bloques cross-project verdes
- `run-qa` confiable
- `test:all` confiable
- criterio de release documentado
- estado final listo para decisión de QA manual

### Artefactos esperados

- `.qa/latest.json`
- `.qa/runs/...`
- `docs/testing/monorepo-qa-status.md`
- workbook actualizado
- reportes finales de estado

### Criterio de salida

- cross-project core verde
- `test:all` verde
- `run-qa` verde
- workbook con evidencia reciente
- sin quality gates críticos fallando

### Riesgos que deben bajar

- fallos entre sistemas
- release con pipeline engañoso
- divergencia entre documentación y runtime

### Prompt operativo para el agente

```text
Actuá como release quality engineer y owner del cierre QA automatizado.

Objetivo de esta iteración:
cerrar handoffs cross-project, consolidar la señal final de calidad del sistema y preparar la entrada a QA manual.

Trabajo obligatorio:
1. dejar verdes los bloques cross-project core
2. consolidar `run-qa` y `test:all`
3. endurecer quality-static y gates CI
4. actualizar workbook y reportes con evidencia reciente real
5. emitir decisión final: listo o no listo para QA manual

Restricciones:
- no declarar cierre por docs si el runtime falla
- no ocultar bloques rojos
- no meter deferred dentro del gate final

Entregables:
- bloques cross-project verdes
- señal consolidada de sistema
- workbook actualizado
- decisión final con bloqueantes residuales si existen

Criterio de éxito:
- `run-qa` verde
- `test:all` verde
- evidencia reciente en workbook
- base automatizada confiable para iniciar QA manual
```

---

## Backlog transversal permanente

Estas tareas no pertenecen a una sola iteración; acompañan todo el proceso.

### Siempre mantener

- bug real -> regresión automatizada
- workbook alineado con runtime
- reportes de testing actualizados
- separación core/deferred
- lectura de riesgo por dominio

### Nunca aceptar

- suites rojas normalizadas
- coverage artificial
- `skip` invisibles
- CI verde sin salud real
- QA manual como sustituto de automation faltante

## Criterio de finalización global

El backlog queda formalmente cerrado cuando:

1. Iteración 1 cumple su criterio de salida.
2. Iteración 2 cumple su criterio de salida.
3. Iteración 3 cumple su criterio de salida.
4. Se cumplen los criterios globales de [qa-readiness-roadmap.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/qa-readiness-roadmap.md).

## Qué hacer al cierre de cada iteración

1. ejecutar validaciones reales;
2. actualizar workbook y reportes;
3. registrar estado por dominio;
4. decidir explícitamente:
   - `iteración cerrada`
   - o `iteración no cerrada` con bloqueantes;
5. recién ahí preparar commit o continuar a la siguiente iteración.

