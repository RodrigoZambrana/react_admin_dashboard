# QA Readiness Roadmap

Fecha base: `2026-05-09`

## Propósito

Este documento define la hoja de ruta oficial para llevar el sistema a un estado real de pruebas confiables antes de habilitar QA manual de cierre.

Regla central:

> QA manual no debe descubrir bugs básicos, regresiones obvias ni flujos core rotos.

La automatización debe absorber primero:

- lógica de negocio crítica
- validaciones estructurales
- smoke browser core
- handoffs cross-project
- contratos y gobernanza

## Objetivo final

Lograr un estado real de pruebas de todo el sistema y sus funcionalidades relevantes, con:

- evidencia ejecutable
- trazabilidad confiable
- runtime reciente
- suites estables
- documentación alineada

## Estado base actual

### Fortalezas

- `backend` es hoy la base determinística más estable.
- `frontend` tiene suite unitaria ejecutable.
- `ecommerce` recuperó su base operativa principal:
  - `test`
  - `test:smoke`
  - `test:e2e:critical`
  - `test:integrity`
- `services/channel-adapter` tiene tests reales y runner ejecutable.
- `ai-platform` está inventariado y puede mantenerse fuera del gate core.

### Limitaciones abiertas

- la última corrida QA integral todavía no es completamente verde;
- siguen existiendo diferencias entre “caso verde en workbook” y “caso recientemente revalidado”;
- no toda la cobertura del sistema completo está consolidada en un gate único y confiable;
- CI/CD todavía no representa salud real de todo el sistema.

## Principios operativos

1. No aceptar falso verde.
2. No aceptar specs inexistentes en runners críticos.
3. No aceptar `skip` sosteniendo cobertura declarada.
4. No aceptar cobertura sin runtime reciente.
5. No mezclar AI/conversacional dentro del gate core determinístico.
6. No usar QA manual como sustituto de automatización faltante.
7. Todo bug real descubierto debe convertirse, cuando sea razonable, en regresión automatizada.

## Arquitectura de pruebas objetivo

La estrategia de calidad debe organizarse en cinco capas.

### Capa 1. Integridad y gobernanza

Objetivo:

- impedir cobertura ficticia
- detectar deriva entre runner, workbook y repo

Debe validar:

- specs faltantes
- evidencia de workbook inválida
- `skip` en casos marcados como cubiertos
- bloques QA huérfanos
- comandos críticos rotos

### Capa 2. Deterministic core

Objetivo:

- validar lógica de negocio sin ruido de entorno

Incluye:

- `backend`
- `frontend`
- `ecommerce` Vitest
- `services/channel-adapter`

### Capa 3. Browser smoke core

Objetivo:

- detectar roturas visibles del producto antes de QA manual

Debe cubrir:

- home
- catálogo
- PDP
- carrito
- checkout
- pagos
- auth
- admin sign-in
- admin order detail
- superficies CMS críticas

### Capa 4. Cross-project regression

Objetivo:

- validar handoffs reales entre sistemas

Incluye:

- storefront -> backend
- checkout -> orders
- orders -> notifications
- storefront -> admin
- payments -> admin reconciliation
- analytics estructural
- sesiones cross-app
- integraciones críticas

### Capa 5. Deferred / extended

Objetivo:

- inventariar sin bloquear el core

Incluye:

- AI
- webchat
- conversaciones
- validación semántica
- loops dependientes de modelos externos

## Dominios funcionales que deben quedar explícitamente cubiertos

### Core ecommerce

- auth
- permissions
- catálogo
- PDP
- carrito
- checkout
- pagos
- órdenes
- pricing
- inventory
- búsqueda
- CMS
- analytics estructural
- notificaciones

### Core admin y operación

- admin sign-in
- RBAC
- order detail
- customer notifications
- workflows críticos de operación
- inbox/manual operations

### Backend y soporte

- APIs críticas
- jobs y queues relevantes
- integraciones
- channel adapters

### Deferred

- AI/conversations
- LLM evaluation
- semantic correctness

## Fases de ejecución

### Fase 0. Gobernanza confiable

Meta:

- ningún caso verde depende de evidencia inválida

Trabajo:

- endurecer `test:integrity`
- validar workbook contra specs reales
- detectar `skip`
- asegurar scripts explícitos por workspace

Salida:

- workbook confiable
- runners confiables
- manifest confiable

### Fase 1. Core determinístico completo

Meta:

- toda lógica crítica validada sin browser

Trabajo:

- consolidar `backend`, `frontend`, `ecommerce`, `channel-adapter`
- mantener separación entre core y deferred
- elevar coverage útil en dominios de riesgo alto

Salida:

- lógica de negocio crítica protegida

### Fase 2. Smoke browser core completo

Meta:

- ningún flujo visible crítico llega roto a manual QA

Trabajo:

- mantener smoke rápido, reproducible y estable
- cubrir storefront y admin core
- incluir pagos y checkout reales

Salida:

- smoke browser verde

### Fase 3. Cross-project y handoffs

Meta:

- el sistema completo funciona de punta a punta

Trabajo:

- storefront/backend/admin
- notifications
- analytics estructural
- sesiones cruzadas
- integraciones críticas

Salida:

- bloques cross-project verdes

### Fase 4. Consolidación para release

Meta:

- tener una señal única y confiable del estado real de calidad

Trabajo:

- consolidar `test:all`
- consolidar `run-qa`
- alinear workbook con runtime reciente
- elevar gates CI/CD

Salida:

- estado de pruebas confiable para preparación de QA manual

## Orden de priorización en próximas iteraciones

1. Cerrar la corrida QA integral hoy fallida.
2. Mantener `ecommerce` core verde mientras se corrigen los bloques abiertos.
3. Elevar confiabilidad cross-project.
4. Consolidar quality gates estáticos y CI real.
5. Recién después ampliar cobertura no core o deferred.

## Qué significa “realmente probado”

No significa:

- tener muchos archivos `.spec`
- tener coverage global decorativa
- tener un workbook históricamente verde

Sí significa:

- que los dominios críticos tienen pruebas automáticas ejecutables
- que esas pruebas se corren realmente
- que las corridas dejan evidencia reciente
- que los flujos core no dependen de interpretación manual para validarse

## Criterio de finalización global

El sistema solo puede considerarse listo para iniciar QA manual de cierre cuando se cumplan todos estos puntos:

1. `test:integrity` verde en todos los workspaces core.
2. `backend`, `frontend`, `ecommerce` y `services/channel-adapter` con suites core verdes.
3. smoke browser core verde y reproducible.
4. bloques cross-project core verdes.
5. workbook alineado con evidencia ejecutable y fecha reciente.
6. sin casos críticos en `PENDIENTE`.
7. sin casos verdes sostenidos por `skip`.
8. sin specs faltantes en gates críticos.
9. sin quality gates estáticos fallando.
10. sin bloques QA críticos fallidos en `run-qa` o `test:all`.

## Definition of Done por fase

### DoD Fase 0

- runners críticos formalizados
- workbook sin falso verde
- integridad multi-workspace ejecutable

### DoD Fase 1

- deterministic core verde
- coverage útil en dominios de mayor riesgo
- AI fuera del gate core

### DoD Fase 2

- smoke browser core verde
- flujos visibles críticos protegidos

### DoD Fase 3

- handoffs críticos verdes
- notificaciones, sesiones y analytics core revalidados

### DoD Fase 4

- `test:all` confiable
- `run-qa` confiable
- CI/CD representa salud real
- QA manual puede pasar a rol exploratorio/final

## Regla de uso en iteraciones futuras

Toda iteración de testing o estabilización debe responder estas preguntas antes de cerrarse:

1. ¿Qué capa de esta hoja de ruta avanza?
2. ¿Qué dominio funcional queda realmente más protegido?
3. ¿Qué evidencia runtime nueva quedó generada?
4. ¿Qué casos del workbook cambiaron de estado y por qué?
5. ¿Se redujo el riesgo real o solo aumentó el volumen de tests?

## Documentos complementarios

- [audit-report.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/audit-report.md)
- [coverage-gaps.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/coverage-gaps.md)
- [critical-risk-report.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/critical-risk-report.md)
- [runtime-audit.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/runtime-audit.md)
- [qa-alignment-report.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/qa-alignment-report.md)
- [governance-rules.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/governance-rules.md)
- [runtime-integrity-report.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/runtime-integrity-report.md)
- [workbook-validation-report.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/testing/workbook-validation-report.md)
